import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Common } from '@/constants/styles';
import { Alpha, Radius, Spacing, withAlpha } from '@/constants/theme';
import { formatTime } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { describeFrequency, getStats, weeklyRates } from '@/lib/habit-utils';
import { useHabit } from '@/lib/habits-store';

import { HistoryCalendar, StatTile, WeeklyBars } from './habit-charts';
import { HabitNotFound } from './notice';
import { PressableScale } from './motion';
import { Screen } from './screen';
import { Card, IconBubble, PageScroll, Txt } from './ui';

/** Habit info page (`/habit/[id]`): stats, weekly chart and history calendar. */
export function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habit, log, today, ready, setStatus } = useHabit(id);

  // Unknown id (old link, deep link to a deleted habit): say so instead of a blank page.
  if (!habit) return <Screen>{ready && <HabitNotFound />}</Screen>;

  const frequency = describeFrequency(habit);
  const stats = getStats(habit, log, today);
  const reminders = habit.reminder.enabled
    ? `${habit.reminder.times.map((t) => formatTime(t.hour, t.minute)).join(', ')} · ${frequency}`
    : 'Off';

  return (
    <Screen
      right={
        <PressableScale
          scaleTo={0.9}
          hitSlop={8}
          onPress={() => {
            logTap('edit habit');
            router.push({ pathname: '/edit/[id]', params: { id: habit.id } });
          }}
          style={[styles.edit, { backgroundColor: withAlpha(habit.color, Alpha.soft) }]}>
          <Txt variant="bodyStrong" color={habit.color}>
            Edit
          </Txt>
        </PressableScale>
      }>
      <PageScroll>
        <View style={styles.hero}>
          <IconBubble icon={habit.icon} color={habit.color} size={84} />
          <Txt variant="title" style={Common.textCenter}>
            {habit.name}
          </Txt>
          {!!habit.description && (
            <Txt tone="textSecondary" style={[Common.textCenter, styles.regular]}>
              {habit.description}
            </Txt>
          )}
        </View>

        <Card style={styles.info}>
          <InfoRow label="Frequency" value={frequency} />
          <InfoRow label="Reminders" value={reminders} />
        </Card>

        <View style={[Common.row, styles.stats]}>
          <StatTile value={`${stats.currentStreak}`} label="Streak 🔥" color={habit.color} />
          <StatTile value={`${stats.bestStreak}`} label="Best" color={habit.color} />
          <StatTile
            value={`${Math.round(stats.completionRate * 100)}%`}
            label="Success"
            color={habit.color}
          />
        </View>

        <WeeklyBars buckets={weeklyRates(habit, log, today, 8)} color={habit.color} />

        <HistoryCalendar
          habit={habit}
          log={log}
          today={today}
          onToggleDay={(key, state) => {
            if (state !== 'done') setStatus(habit.id, key, 'done');
            else setStatus(habit.id, key, key === today ? null : 'missed');
          }}
        />
      </PageScroll>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[Common.spread, styles.infoRow]}>
      <Txt tone="textSecondary">{label}</Txt>
      <Txt numberOfLines={2} style={styles.infoValue}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  edit: { justifyContent: 'center', height: 36, paddingHorizontal: Spacing.three, borderRadius: Radius.pill },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  regular: { fontWeight: '400' },
  info: { gap: Spacing.two },
  infoRow: { gap: Spacing.three },
  infoValue: { flexShrink: 1, textAlign: 'right' },
  stats: { gap: Spacing.two },
});
