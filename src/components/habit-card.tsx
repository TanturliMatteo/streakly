import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Alpha, Radius, Spacing, type Theme, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, fromKey, toKey, WEEKDAY_LETTER } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { dayState, getStats } from '@/lib/habit-utils';
import type { DayState, Habit, HabitLog } from '@/lib/types';

import { colorTransition, PressableScale } from './motion';
import { Card, CheckButton, IconBubble, Txt } from './ui';

function dotColor(state: DayState, color: string, theme: Theme) {
  switch (state) {
    case 'done':
      return color;
    case 'missed':
      return withAlpha(theme.danger, Alpha.strong);
    case 'pending':
      return withAlpha(color, Alpha.medium);
    default:
      return theme.backgroundSelected;
  }
}

/** Home-screen card: icon, name, streak, today's check button and the last 7 days. */
export function HabitCard({
  habit,
  log,
  today,
  onToggle,
}: {
  habit: Habit;
  log: HabitLog;
  today: string;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const state = dayState(habit, log, today, today);
  const done = state === 'done';
  const scheduledToday = state !== 'off';
  const { currentStreak } = getStats(habit, log, today);
  const last7 = Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(today), i - 6)));

  const subtitle = !scheduledToday
    ? 'Rest day'
    : currentStreak > 0
      ? `🔥 ${currentStreak} day streak`
      : habit.description || 'Start your streak today';

  return (
    <PressableScale
      scaleTo={0.97}
      onPress={() => {
        logTap(`habit card "${habit.name}"`);
        router.push({ pathname: '/habit/[id]', params: { id: habit.id } });
      }}>
      <Card style={[styles.card, !scheduledToday && styles.dimmed]}>
        <View style={styles.row}>
          <IconBubble icon={habit.icon} color={habit.color} />
          <View style={styles.texts}>
            <Txt variant="heading" numberOfLines={1}>
              {habit.name}
            </Txt>
            <Txt variant="note" tone="textSecondary" numberOfLines={1}>
              {subtitle}
            </Txt>
          </View>
          <CheckButton
            done={done}
            color={habit.color}
            onPress={onToggle}
            logLabel={`today "${habit.name}"`}
          />
        </View>
        <View style={styles.dots}>
          {last7.map((key) => (
            <View key={key} style={styles.dotCol}>
              <Animated.View
                style={[
                  styles.dot,
                  colorTransition,
                  { backgroundColor: dotColor(dayState(habit, log, key, today), habit.color, theme) },
                ]}
              />
              <Txt variant="micro" tone={key === today ? 'text' : 'textMuted'}>
                {WEEKDAY_LETTER[fromKey(key).getDay()]}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  dimmed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  texts: { flex: 1, gap: 2 },
  dots: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.one },
  dotCol: { alignItems: 'center', gap: Spacing.one },
  dot: { width: 14, height: 14, borderRadius: Radius.pill },
});
