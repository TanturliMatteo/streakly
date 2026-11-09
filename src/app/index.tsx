import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitList } from '@/components/habit-list';
import { Notice } from '@/components/notice';
import { Motion, PressableScale } from '@/components/motion';
import { ProgressCard } from '@/components/progress-card';
import { Card, PageScroll, PrimaryButton, RoundButton, Txt } from '@/components/ui';
import { Common } from '@/constants/styles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fromKey, MONTHS, WEEKDAY_SHORT } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { dayState, isDue } from '@/lib/habit-utils';
import { useHabits } from '@/lib/habits-store';

const openNewHabit = () => router.push('/new');

/** Home: today's date, progress, and one card per habit (due today first, rest days last). */
export default function TodayScreen() {
  const theme = useTheme();
  const { habits, logs, today, ready, loadIssue, setStatus, reorderHabits, deleteHabit } = useHabits();
  const date = fromKey(today);

  // One pass: today's state per habit, plus the counts for the progress card.
  let due = 0;
  let done = 0;
  const items = habits.map((habit) => {
    const state = dayState(habit, logs[habit.id] ?? {}, today, today);
    if (isDue(state)) due++;
    if (state === 'done') done++;
    return { habit, state };
  });
  items.sort((a, b) => Number(a.state === 'off') - Number(b.state === 'off'));

  const progressLabel = !ready
    ? 'Daily progress'
    : habits.length === 0
      ? 'Add a habit to start'
      : due === 0
        ? 'Rest day, nothing due 🌙'
        : done === due
          ? 'All done for today 🎉'
          : 'Daily progress';

  return (
    <SafeAreaView style={[Common.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <PageScroll>
        <View style={[Common.row, styles.header]}>
          <View style={Common.flex}>
            <Txt variant="label" tone="textSecondary" style={styles.date}>
              {WEEKDAY_SHORT[date.getDay()]}, {date.getDate()} {MONTHS[date.getMonth()]}
            </Txt>
            <Txt variant="largeTitle">Today</Txt>
          </View>
          <RoundButton
            glyph="⚙︎"
            size={48}
            glyphSize={24}
            accessibilityLabel="Settings"
            logLabel="settings"
            onPress={() => router.push('/settings')}
          />
          <PressableScale
            scaleTo={0.88}
            accessibilityLabel="New habit"
            onPress={() => {
              logTap('+ new habit');
              openNewHabit();
            }}
            style={[Common.circle, styles.add, { backgroundColor: theme.text }]}>
            <Txt tone="background" style={styles.addGlyph}>
              +
            </Txt>
          </PressableScale>
        </View>

        <ProgressCard label={progressLabel} done={done} due={due} />

        {loadIssue === 'unreadable' && (
          <Notice
            icon="⚠️"
            title="Couldn’t load your habits"
            message="Your saved data wasn’t changed. Close and reopen the app to try again. Changes made now won’t be saved."
          />
        )}
        {loadIssue === 'repaired' && (
          <Notice
            icon="🛠️"
            title="Some saved data was damaged"
            message="It was repaired where possible, and a copy of the original was kept on this device."
          />
        )}

        {ready && habits.length === 0 && (
          <Card entering={Motion.enter} style={styles.empty}>
            <Txt style={styles.emptyIcon}>🌱</Txt>
            <Txt variant="headline">No habits yet</Txt>
            <Txt tone="textSecondary" style={[Common.textCenter, styles.emptyText]}>
              Create your first habit and start building your streak.
            </Txt>
            <View style={styles.stretch}>
              <PrimaryButton label="Create a habit" onPress={openNewHabit} />
            </View>
          </Card>
        )}

        <HabitList
          items={items}
          logs={logs}
          today={today}
          onToggle={({ habit, state }) => setStatus(habit.id, today, state === 'done' ? null : 'done')}
          onReorder={reorderHabits}
          onDelete={(habit) => deleteHabit(habit.id)}
        />
      </PageScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: Spacing.two, gap: Spacing.two },
  date: { textTransform: 'uppercase', letterSpacing: 0.5 },
  add: { width: 48, height: 48 },
  addGlyph: { fontSize: 28, fontWeight: '500', lineHeight: 32 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  emptyIcon: { fontSize: 48, lineHeight: 56 },
  emptyText: { marginBottom: Spacing.two, fontWeight: '400' },
  stretch: { alignSelf: 'stretch' },
});
