import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitCard } from '@/components/habit-card';
import { Motion, PressableScale } from '@/components/motion';
import { ProgressCard } from '@/components/progress-card';
import { Card, PageScroll, PrimaryButton, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fromKey, MONTHS, WEEKDAY_SHORT } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { dayState } from '@/lib/habit-utils';
import { useHabits } from '@/lib/habits-store';

const openNewHabit = () => router.push('/new');

export default function TodayScreen() {
  const theme = useTheme();
  const { habits, logs, today, ready, setStatus } = useHabits();
  const date = fromKey(today);

  const withState = habits.map((h) => ({ habit: h, state: dayState(h, logs[h.id] ?? {}, today, today) }));
  const dueToday = withState.filter((x) => x.state !== 'off');
  const doneToday = dueToday.filter((x) => x.state === 'done').length;
  const allDone = dueToday.length > 0 && doneToday === dueToday.length;
  const progressLabel = !ready
    ? 'Daily progress'
    : habits.length === 0
      ? 'Add a habit to start'
      : dueToday.length === 0
        ? 'Rest day, nothing due 🌙'
        : allDone
          ? 'All done for today 🎉'
          : 'Daily progress';

  // Scheduled-today first, rest days last.
  const sorted = [...withState].sort((a, b) => Number(a.state === 'off') - Number(b.state === 'off'));

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <PageScroll>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Txt variant="label" tone="textSecondary" style={styles.date}>
              {WEEKDAY_SHORT[date.getDay()]}, {date.getDate()} {MONTHS[date.getMonth()]}
            </Txt>
            <Txt variant="largeTitle">Today</Txt>
          </View>
          <PressableScale
            scaleTo={0.88}
            onPress={() => {
              logTap('+ new habit');
              openNewHabit();
            }}
            accessibilityLabel="New habit"
            style={[styles.add, { backgroundColor: theme.text }]}>
            <Txt tone="background" style={styles.addText}>
              +
            </Txt>
          </PressableScale>
        </View>

        {/* Always visible: the text adapts to "no habits", "rest day", "in progress" and "all done". */}
        <ProgressCard label={progressLabel} done={doneToday} due={dueToday.length} />

        {ready && habits.length === 0 && (
          <Card entering={Motion.enter} style={styles.empty}>
            <Txt style={styles.emptyIcon}>🌱</Txt>
            <Txt variant="headline">No habits yet</Txt>
            <Txt tone="textSecondary" style={styles.emptyText}>
              Create your first habit and start building your streak.
            </Txt>
            <View style={styles.stretch}>
              <PrimaryButton label="Create a habit" onPress={openNewHabit} />
            </View>
          </Card>
        )}

        {sorted.map(({ habit, state }, index) => (
          <Animated.View key={habit.id} entering={Motion.stagger(index + 1)} exiting={Motion.exit}>
            <HabitCard
              habit={habit}
              log={logs[habit.id] ?? {}}
              today={today}
              onToggle={() => setStatus(habit.id, today, state === 'done' ? null : 'done')}
            />
          </Animated.View>
        ))}
      </PageScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stretch: { alignSelf: 'stretch' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two },
  date: { textTransform: 'uppercase', letterSpacing: 0.5 },
  add: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 28, fontWeight: '500', lineHeight: 32 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyIcon: { fontSize: 48, lineHeight: 56 },
  emptyText: { textAlign: 'center', fontWeight: '400', marginBottom: Spacing.two },
});
