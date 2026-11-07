/**
 * `<Screen>`: the shell of every pushed page (habit info, new habit, edit habit).
 *
 * - Slide transition: pages are presented over the previous one (`transparentModal`, no native
 *   animation), so the page below stays loaded and visible. The page slides in from the right;
 *   on back (‹ button, Android back, swipe right) it slides out to the right *first*, while still
 *   fully rendered, and only once off-screen lets the navigator remove it. Open, close and
 *   swipe-back share one duration and curve. Only `translateX` is animated (fast path).
 * - Header: round back button, centred title, optional right action.
 * - Keyboard: content moves up so inputs stay visible.
 */
import { router, useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Common } from '@/constants/styles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logEvent } from '@/lib/debug-log';

import { Duration, Ease, Springs } from './motion';
import { RoundButton, Txt } from './ui';

const SLIDE = { duration: Duration.page, easing: Ease };
const CLOSE_FRACTION = 0.33; // swipe past a third of the screen…
const CLOSE_VELOCITY = 800; // …or flick to close

type NavigationAction = Parameters<NonNullable<Parameters<typeof usePreventRemove>[1]>>[0]['data']['action'];

export function Screen({
  title,
  right,
  children,
}: {
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
          <KeyboardAvoidingView behavior="padding" style={Common.flex}>
            <View style={[Common.row, styles.header, { paddingTop: insets.top + Spacing.two }]}>
              <RoundButton
                glyph="‹"
                glyphSize={28}
                accessibilityLabel="Back"
                logLabel={`back from "${title ?? 'screen'}"`}
                onPress={() => router.back()}
              />
              <Txt variant="heading" numberOfLines={1} style={[Common.flex, Common.textCenter]}>
                {title}
              </Txt>
              <View style={styles.right}>{right}</View>
            </View>
            {children}
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureDetector>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    // soft edge shadow so the page reads as sliding over the one below
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  header: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  right: { minWidth: 40, alignItems: 'flex-end' },
});
