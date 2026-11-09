import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Timing } from './motion';

const TIMING = Timing.base;

/**
 * Shows / hides its children by animating the real height (and opacity) together, so whatever is
 * below moves in step with the content, instead of jumping first and then watching it fade.
 * Size changes while open (e.g. a time picker expanding inside) animate smoothly too.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  // Keep children mounted until the collapse has finished.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const progress = useSharedValue(open ? 1 : 0);
  const height = useSharedValue(0);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    progress.set(
      withTiming(open ? 1 : 0, TIMING, (finished) => {
        if (finished && !open) scheduleOnRN(setMounted, false);
      }),
    );
  }, [open, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    height: height.get() * progress.get(),
    opacity: progress.get(),
  }));

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.clip, containerStyle]}>
      {/* Laid out at its natural height; the container reveals it. */}
      <View
        style={styles.content}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (measured) {
            height.set(withTiming(h, TIMING));
          } else {
            height.set(h);
            setMeasured(true);
          }
        }}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { position: 'absolute', top: 0, left: 0, right: 0 },
});
