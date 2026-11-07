import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Common } from '@/constants/styles';
import { Alpha, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, MONTHS, startOfWeek, toKey, WEEK_ORDER, WEEKDAY_LETTER } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { dayState, type WeekBucket } from '@/lib/habit-utils';
import type { DayState, Habit, HabitLog } from '@/lib/types';

import { dayColors } from './day-colors';
import { colorTransition, Duration, Motion, PressableScale, transition } from './motion';
import { Card, RoundButton, SectionLabel, Txt } from './ui';

const BAR_HEIGHT = 120;
const CELL = 38;

// ─── Stat tile ──────────────────────────────────────────────────────────────

export function StatTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <Card style={[Common.flex, Common.center, styles.stat]}>
      <Txt variant="stat" color={color}>
        {value}
      </Txt>
      <Txt variant="caption" tone="textSecondary" style={styles.statLabel}>
        {label}
      </Txt>
    </Card>
  );
}

// ─── Weekly bars ────────────────────────────────────────────────────────────

/** Rounded bar chart: completion % per week. */
export function WeeklyBars({ buckets, color }: { buckets: WeekBucket[]; color: string }) {
  return (
    <Card>
      <SectionLabel>Weekly completion</SectionLabel>
      <View style={[Common.spread, styles.bars]}>
        {buckets.map((b) => {
          const pct = b.rate ?? 0;
          return (
            <View key={b.start.toISOString()} style={[Common.flex, styles.barColumn]}>
              <Txt variant="micro" tone="textSecondary">
                {b.rate === null ? '–' : `${Math.round(pct * 100)}`}
              </Txt>
              <View style={[styles.barTrack, { backgroundColor: withAlpha(color, Alpha.soft) }]}>
                <Animated.View
                  style={[
                    styles.barFill,
                    transition('height', Duration.slow), // bars grow / shrink when the data changes
                    { height: pct === 0 ? 0 : Math.max(BAR_HEIGHT * pct, 14), backgroundColor: color },
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

// ─── History calendar ───────────────────────────────────────────────────────

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
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Card>
      <View style={[Common.row, Common.spread, styles.calendarHeader]}>
        <RoundButton
          glyph="‹"
          size={34}
          background="backgroundSelected"
          disabled={toKey(month) <= habit.createdAt}
          accessibilityLabel="Previous month"
          logLabel="calendar prev month"
          onPress={() => shift(-1)}
        />
        <Txt variant="heading">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Txt>
        <RoundButton
          glyph="›"
          size={34}
          background="backgroundSelected"
          disabled={toKey(addDays(last, 1)) > today}
          accessibilityLabel="Next month"
          logLabel="calendar next month"
          onPress={() => shift(1)}
        />
      </View>

      <View style={[Common.spread, styles.calendarRow]}>
        {WEEK_ORDER.map((d) => (
          <Txt key={d} variant="caption" tone="textMuted" style={[Common.textCenter, styles.weekday]}>
            {WEEKDAY_LETTER[d]}
          </Txt>
        ))}
      </View>

      {/* key: the month grid fades in when switching months */}
      <Animated.View key={toKey(month)} entering={Motion.fadeIn}>
        {weeks.map((week) => (
          <View key={toKey(week[0])} style={[Common.spread, styles.calendarRow]}>
            {week.map((day) => {
              const key = toKey(day);
              if (day.getMonth() !== month.getMonth()) return <View key={key} style={styles.cell} />;
              const state = dayState(habit, log, key, today);
              const colors = dayColors(state, habit.color, theme);
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
                    Common.circle,
                    styles.cell,
                    colorTransition,
                    { backgroundColor: colors.fill, borderColor: colors.border },
                  ]}>
                  <Txt variant="label" color={colors.text} style={key === today && styles.today}>
                    {day.getDate()}
                  </Txt>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </Animated.View>

      <View style={[Common.row, styles.legend]}>
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={[Common.row, styles.legendItem]}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Txt variant="caption" tone="textSecondary">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  // stat tile
  stat: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.two },
  statLabel: { marginTop: 2 },
  // weekly bars
  bars: { alignItems: 'flex-end' },
  barColumn: { alignItems: 'center', gap: 6 },
  barTrack: {
    justifyContent: 'flex-end',
    width: 18,
    height: BAR_HEIGHT,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: Radius.pill },
  // calendar
  calendarHeader: { marginBottom: Spacing.three },
  calendarRow: { marginBottom: 6 },
  weekday: { width: CELL },
  cell: { width: CELL, height: CELL, borderWidth: 2, borderColor: 'transparent' },
  today: { fontWeight: '900' },
  legend: { flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.two },
  legendItem: { gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: Radius.pill },
  hint: { marginTop: Spacing.two, fontWeight: '400' },
});
