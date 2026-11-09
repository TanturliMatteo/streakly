import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { logEvent } from '@/lib/debug-log';

import { Ease } from './motion';

/** Same colour and image as the native splash (`expo-splash-screen` in app.json). */
const SPLASH_COLOR = '#5B5BD6';
const DURATION = 600;

const fadeOut = new Keyframe({
  0: { opacity: 1 },
  20: { opacity: 1 },
  70: { opacity: 0, easing: Ease },
  100: { opacity: 0 },
});

/**
 * Takes over from the native splash screen as soon as the app has laid out, then fades away,
 * so the first frame of the app appears smoothly instead of popping in.
 */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const image = <Image style={styles.image} source={require('@/assets/images/splash-icon.png')} />;

  return animate ? (
    <Animated.View
      entering={fadeOut.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync()
          .catch((e) => logEvent('error', `hiding the splash screen failed: ${String(e)}`))
          .finally(() => setAnimate(true));
      }}
      style={styles.splashOverlay}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 96,
    height: 96,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SPLASH_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
