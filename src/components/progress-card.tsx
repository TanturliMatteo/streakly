import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Common } from '@/constants/styles';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Duration, Ease, Motion } from './motion';
import { Card, Txt } from './ui';

/**
 * "Today" progress: label, done/due count and a bar. Always visible on the home screen.
 *
 * The bar is driven by a shared value that is re-targeted every time the numbers change, so it
 * always lands on the right width, even when the change happened while another page covered
 * the home screen (e.g. a habit created on the "New habit" page). The texts are re-mounted
 * (with a fade) whenever the totals change, so they never show stale numbers either.
 */
export function ProgressCard({ label, done, due }: { label: string; done: number; due: number }) {
  const theme = useTheme();
  const progress = due > 0 ? done / due : 0;
  const width = useSharedValue(progress);

  useEffect(() => {
    width.set(withTiming(progress, { duration: Duration.slow, easing: Ease }));
  }, [progress, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));
  const countKey = `${done}/${due}`;

  return (
    <Card entering={Motion.stagger(0)} style={styles.card}>
      <Animated.View
        key={`${label}|${countKey}`}
        entering={Motion.fadeIn}
        style={[Common.spread, styles.row]}>
        <Txt variant="bodyStrong" style={styles.label} numberOfLines={1}>
          {label}
        </Txt>
        <Txt variant="bodyStrong" tone="textSecondary">
          {countKey}
        </Txt>
      </Animated.View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <Animated.View style={[styles.fill, { backgroundColor: theme.tint }, fillStyle]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  row: { gap: Spacing.two },
  label: { flexShrink: 1 },
  track: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
