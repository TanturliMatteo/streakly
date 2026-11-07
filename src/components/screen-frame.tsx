/**
 * Root of every pushed screen, and the slide transition itself.
 *
 * Screens are presented over the previous one (`transparentModal`, no native animation), so the
 * page underneath stays fully loaded and visible. This frame then:
 * - slides in from the right when it opens;
 * - on back (‹ button, Android back, swipe right) slides out to the right *first*, while still
 *   fully rendered, and only once it is off-screen lets the navigator actually remove it.
 * So you always see two complete pages, never a blank one. Open, close and swipe-back all use
 * the same duration and curve (`Duration.page`, `Ease`).
 *
 * Only `transform: translateX` is animated (the fast path), so it stays smooth.
 */
import { useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/hooks/use-theme';
import { logEvent } from '@/lib/debug-log';

import { Duration, Ease, Springs } from './motion';

const SLIDE = { duration: Duration.page, easing: Ease };
const CLOSE_FRACTION = 0.33; // swipe past a third of the screen…
const CLOSE_VELOCITY = 800; // …or flick to close

type NavigationAction = Parameters<NonNullable<Parameters<typeof usePreventRemove>[1]>>[0]['data']['action'];

export function ScreenFrame({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { width: W } = useWindowDimensions();
  const navigation = useNavigation();
  const x = useSharedValue(W); // 0 = on screen, W = off to the right
  // The blocked "remove this screen" action, released once the page has slid off.
  const [released, setReleased] = useState<NavigationAction | null>(null);

  // Slide in, starting on the very first painted frame.
  useLayoutEffect(() => {
    x.set(withTiming(0, SLIDE));
  }, [x]);

  usePreventRemove(released === null, ({ data }) => {
    logEvent('nav', `slide out (${data.action.type})`);
    const release = () => setReleased(data.action);
    x.set(withTiming(W, SLIDE, () => scheduleOnRN(release)));
  });

  // Prevention is off now (usePreventRemove's own effect runs first), so this really removes it.
  useEffect(() => {
    if (released) navigation.dispatch(released);
  }, [released, navigation]);

  const goBack = () => navigation.goBack();
  const swipe = usePanGesture({
    activeOffsetX: 12, // only rightward drags…
    failOffsetY: [-12, 12], // …and vertical movement is left to scrolling
    onUpdate: (e) => {
      'worklet';
      x.set(Math.max(0, e.translationX));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX > W * CLOSE_FRACTION || e.velocityX > CLOSE_VELOCITY) {
        scheduleOnRN(goBack); // continues the slide from where the finger left it
      } else {
        x.set(withSpring(0, Springs.settle));
      }
    },
  });

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    // skipExiting: Reanimated must not pull animated children out early when the page is removed.
    <LayoutAnimationConfig skipExiting>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.page, { backgroundColor: theme.background }, slideStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    // soft edge shadow so the page reads as sliding over the one below
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: -4, height: 0 },
    elevation: 16,
  },
});
