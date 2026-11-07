import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Alpha, Radius, Spacing, withAlpha } from '@/constants/theme';
import { formatTime } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { describeFrequency, getStats, weeklyRates } from '@/lib/habit-utils';
import { useHabit } from '@/lib/habits-store';

import { HistoryCalendar, StatTile, WeeklyBars } from './habit-charts';
import { PressableScale } from './motion';
import { ScreenHeader } from './screen-header';
import { Card, IconBubble, PageScroll, Txt } from './ui';

/** Habit info: stats, weekly chart and history calendar. */
export function HabitDetailScreen({ id }: { id: string }) {
  const { habit, log, today, setStatus } = useHabit(id);

  if (!habit) return <ScreenHeader />;

  const stats = getStats(habit, log, today);
  const reminderText = habit.reminder.enabled
    ? `${habit.reminder.times.map((t) => formatTime(t.hour, t.minute)).join(', ')} · ${describeFrequency(habit)}`
    : 'Off';

  return (
    <>
      <ScreenHeader
        right={
          <PressableScale
            scaleTo={0.9}
            hitSlop={8}
            onPress={() => {
              logTap('edit habit');
              router.push({ pathname: '/edit/[id]', params: { id: habit.id } });
            }}
            style={[styles.editButton, { backgroundColor: withAlpha(habit.color, Alpha.soft) }]}>
            <Txt variant="bodyStrong" color={habit.color}>
              Edit
            </Txt>
          </PressableScale>
        }
      />
      <PageScroll>
        <View style={styles.hero}>
          <IconBubble icon={habit.icon} color={habit.color} size={84} />
          <Txt variant="title" style={styles.centered}>
            {habit.name}
          </Txt>
          {!!habit.description && (
            <Txt tone="textSecondary" style={[styles.centered, styles.regular]}>
              {habit.description}
            </Txt>
          )}
        </View>

        <Card style={styles.info}>
          <InfoRow label="Frequency" value={describeFrequency(habit)} />
          <InfoRow label="Reminders" value={reminderText} />
        </Card>

        <View style={styles.stats}>
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
            if (state === 'done') setStatus(habit.id, key, key === today ? null : 'missed');
            else setStatus(habit.id, key, 'done');
          }}
        />
      </PageScroll>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Txt tone="textSecondary">{label}</Txt>
      <Txt numberOfLines={2} style={styles.infoValue}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  editButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  centered: { textAlign: 'center' },
  regular: { fontWeight: '400' },
  info: { gap: Spacing.two },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  infoValue: { flexShrink: 1, textAlign: 'right' },
  stats: { flexDirection: 'row', gap: Spacing.two },
});
