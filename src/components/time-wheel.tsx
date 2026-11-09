import { useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { Common } from '@/constants/styles';
import { Alpha, Radius, Spacing, Type, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime, pad } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import type { ReminderTime } from '@/lib/types';

import { Motion, PressableScale } from './motion';
import { RoundButton, Txt } from './ui';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5; // odd, so one row sits in the middle
const PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Vertical snapping wheel: scroll (or tap a row) to pick a value. */
function Wheel({
  values,
  value,
  onChange,
  color,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const ref = useRef<ScrollViewInstance>(null);
  const selectedIndex = Math.max(0, values.indexOf(value));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const next = values[Math.min(values.length - 1, Math.max(0, index))];
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.wheel}>
      <View
        pointerEvents="none"
        style={[styles.highlight, { backgroundColor: withAlpha(color, Alpha.soft) }]}
      />
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={() => ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false })}
        contentContainerStyle={styles.wheelContent}>
        {values.map((v, i) => {
          const distance = Math.abs(i - selectedIndex);
          return (
            <Pressable
              key={v}
              onPress={() => ref.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true })}
              style={[Common.center, styles.item]}>
              <Txt
                tone={distance === 0 ? 'text' : 'textSecondary'}
                style={[
                  styles.itemText,
                  {
                    opacity: distance === 0 ? 1 : distance === 1 ? 0.6 : 0.3,
                    fontSize: distance === 0 ? 26 : 20,
                  },
                ]}>
                {pad(v)}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * A reminder time. Collapsed it shows "09:30"; tap it to open the hour/minute wheels,
 * then "Done" collapses them again.
 */
export function TimeWheel({
  value,
  onChange,
  onRemove,
  color,
  expanded,
  onExpandedChange,
}: {
  value: ReminderTime;
  onChange: (t: ReminderTime) => void;
  onRemove?: () => void;
  color: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const theme = useTheme();
  const label = formatTime(value.hour, value.minute);
  const surface = { backgroundColor: theme.backgroundSelected };

  if (!expanded) {
    return (
      <Animated.View entering={Motion.fadeIn} style={[Common.row, styles.collapsed, surface]}>
        <PressableScale
          scaleTo={0.97}
          style={[Common.flex, Common.row, styles.collapsedMain]}
          accessibilityLabel={`Reminder at ${label}, tap to change`}
          onPress={() => {
            logTap(`open time picker (${label})`);
            onExpandedChange(true);
          }}>
          <Txt variant="stat" style={styles.collapsedTime}>
            {label}
          </Txt>
          <Txt variant="label" color={color}>
            Change
          </Txt>
        </PressableScale>
        {onRemove && (
          <RoundButton
            glyph="✕"
            size={34}
            glyphSize={18}
            tone="danger"
            background="none"
            accessibilityLabel="Remove time"
            logLabel={`remove time ${label}`}
            onPress={onRemove}
          />
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={Motion.fadeIn} style={[styles.expanded, surface]}>
      <View style={[Common.row, styles.wheels]}>
        <Wheel
          values={HOURS}
          value={value.hour}
          color={color}
          onChange={(hour) => onChange({ ...value, hour })}
        />
        <Txt variant="stat">:</Txt>
        <Wheel
          values={MINUTES}
          value={value.minute}
          color={color}
          onChange={(minute) => onChange({ ...value, minute })}
        />
      </View>
      <PressableScale
        scaleTo={0.97}
        onPress={() => {
          logTap(`time picker done → ${label}`);
          onExpandedChange(false);
        }}
        style={[Common.circle, styles.done, { backgroundColor: color }]}>
        <Txt variant="bodyStrong" tone="onAccent">
          Done · {label}
        </Txt>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wheels: { justifyContent: 'center', gap: Spacing.two },
  wheel: { width: 72, height: ITEM_HEIGHT * VISIBLE_ITEMS },
  wheelContent: { paddingVertical: PADDING },
  highlight: {
    position: 'absolute',
    top: PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: Radius.pill,
  },
  item: { height: ITEM_HEIGHT },
  itemText: { ...Type.stat, fontWeight: '700' },
  collapsed: {
    borderRadius: Radius.pill,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    height: 56,
  },
  collapsedMain: {
    justifyContent: 'space-between',
    height: '100%',
    paddingRight: Spacing.two,
  },
  collapsedTime: { fontSize: 24 },
  expanded: { borderRadius: Radius.card, padding: Spacing.two, gap: Spacing.two },
  done: { height: 44 },
});
