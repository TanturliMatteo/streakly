import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Alpha, Radius, Spacing, type Theme, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, MONTHS, startOfWeek, toKey, WEEK_ORDER, WEEKDAY_LETTER } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { dayState, type WeekBucket } from '@/lib/habit-utils';
import type { DayState, Habit, HabitLog } from '@/lib/types';

import { colorTransition, Duration, Motion, PressableScale, transition } from './motion';
import { Card, RoundButton, SectionLabel, Txt } from './ui';

const BAR_HEIGHT = 120;
const CELL = 38;

export function StatTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <Card style={styles.stat}>
      <Txt variant="stat" color={color}>
        {value}
      </Txt>
      <Txt variant="caption" tone="textSecondary" style={styles.statLabel}>
        {label}
      </Txt>
    </Card>
  );
}

/** Rounded bar chart: completion % per week. */
export function WeeklyBars({ buckets, color }: { buckets: WeekBucket[]; color: string }) {
  return (
    <Card>
      <SectionLabel>Weekly completion</SectionLabel>
      <View style={styles.bars}>
        {buckets.map((b) => {
          const pct = b.rate ?? 0;
          return (
            <View key={b.start.toISOString()} style={styles.barCol}>
              <Txt variant="micro" tone="textSecondary">
                {b.rate === null ? '–' : `${Math.round(pct * 100)}`}
              </Txt>
              <View style={[styles.barTrack, { backgroundColor: withAlpha(color, Alpha.soft) }]}>
                <Animated.View
                  style={[
                    styles.barFill,
                    { height: pct === 0 ? 0 : Math.max(BAR_HEIGHT * pct, 14), backgroundColor: color },
                    transition('height', Duration.slow), // bars grow / shrink when the data changes
                  ]}
                />
              </View>
              <Txt variant="micro" tone="textMuted">
                {b.start.getDate()}/{b.start.getMonth() + 1}
              </Txt>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** Month calendar of round day cells. Tap a past day to switch done / not done. */
export function HistoryCalendar({
  habit,
  log,
  today,
  onToggleDay,
}: {
  habit: Habit;
  log: HabitLog;
  today: string;
  onToggleDay: (key: string, state: DayState) => void;
}) {
  const theme = useTheme();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  for (let d = startOfWeek(month); d <= last; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }

  const canGoBack = toKey(month) > habit.createdAt;
  const canGoForward = toKey(addDays(last, 1)) <= today;
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Card>
      <View style={styles.calHeader}>
        <RoundButton
          glyph="‹"
          size={34}
          background="backgroundSelected"
          disabled={!canGoBack}
          logLabel="calendar prev month"
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
        />
        <Txt variant="heading">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Txt>
        <RoundButton
          glyph="›"
          size={34}
          background="backgroundSelected"
          disabled={!canGoForward}
          logLabel="calendar next month"
          accessibilityLabel="Next month"
          onPress={() => shift(1)}
        />
      </View>

      <View style={styles.calRow}>
        {WEEK_ORDER.map((d) => (
          <Txt key={d} variant="caption" tone="textMuted" style={styles.calWeekday}>
            {WEEKDAY_LETTER[d]}
          </Txt>
        ))}
      </View>

      {/* key: the month grid fades in when switching months */}
      <Animated.View key={toKey(month)} entering={Motion.fadeIn}>
        {weeks.map((week) => (
          <View key={toKey(week[0])} style={styles.calRow}>
            {week.map((day) => {
              const key = toKey(day);
              if (day.getMonth() !== month.getMonth()) return <View key={key} style={styles.calCell} />;
              const state = dayState(habit, log, key, today);
              const { bg, fg, border } = cellColors(state, habit.color, theme);
              return (
                <PressableScale
                  key={key}
                  scaleTo={0.82}
                  disabled={state === 'future' || state === 'before'}
                  onPress={() => {
                    logTap(`calendar day ${key} (was ${state})`);
                    onToggleDay(key, state);
                  }}
                  style={[
                    styles.calCell,
                    colorTransition,
                    { backgroundColor: bg, borderColor: border ?? 'transparent' },
                  ]}>
                  <Txt variant="label" color={fg} style={key === today && styles.calToday}>
                    {day.getDate()}
                  </Txt>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </Animated.View>

      <View style={styles.legend}>
        <Legend color={habit.color} label="Done" />
        <Legend color={withAlpha(theme.danger, Alpha.medium)} label="Not done" />
        <Legend color={theme.backgroundSelected} label="Rest day" />
      </View>
      <Txt variant="caption" tone="textMuted" style={styles.hint}>
        Unchecked days are saved as “not done”. Tap a day to change it.
      </Txt>
    </Card>
  );
}

function cellColors(state: DayState, color: string, theme: Theme) {
  switch (state) {
    case 'done':
      return { bg: color, fg: theme.onAccent };
    case 'missed':
      return { bg: withAlpha(theme.danger, Alpha.medium), fg: theme.danger };
    case 'pending':
      return { bg: 'transparent', fg: theme.text, border: color };
    case 'off':
      return { bg: theme.backgroundSelected, fg: theme.textSecondary };
    default:
      return { bg: 'transparent', fg: theme.textMuted };
  }
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Txt variant="caption" tone="textSecondary">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.three, paddingHorizontal: Spacing.two },
  statLabel: { marginTop: 2 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barCol: { alignItems: 'center', gap: 6, flex: 1 },
  barTrack: {
    width: 18,
    height: BAR_HEIGHT,
    borderRadius: Radius.pill,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: Radius.pill },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calWeekday: { width: CELL, textAlign: 'center' },
  calCell: {
    width: CELL,
    height: CELL,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calToday: { fontWeight: '900' },
  legend: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: Radius.pill },
  hint: { marginTop: Spacing.two, fontWeight: '400' },
});
