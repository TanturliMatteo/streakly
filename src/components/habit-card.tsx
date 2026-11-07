import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Common } from '@/constants/styles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, fromKey, toKey, WEEKDAY_LETTER } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import { currentStreak, dayState } from '@/lib/habit-utils';
import type { DayState, Habit, HabitLog } from '@/lib/types';

import { dayColors } from './day-colors';
import { colorTransition, PressableScale } from './motion';
import { Card, CheckButton, IconBubble, Txt } from './ui';

/** Home-screen card: icon, name, streak, today's check button and the last 7 days. */
export function HabitCard({
  habit,
  log,
  today,
  state,
  onToggle,
}: {
  habit: Habit;
  log: HabitLog;
  today: string;
  /** Today's state, already computed by the home screen. */
  state: DayState;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const restDay = state === 'off';
  const streak = restDay ? 0 : currentStreak(habit, log, today);
  const subtitle = restDay
    ? 'Rest day'
    : streak > 0
      ? `🔥 ${streak} day streak`
      : habit.description || 'Start your streak today';

  const start = fromKey(today);
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(start, i - 6));

  return (
    <PressableScale
      scaleTo={0.97}
      onPress={() => {
        logTap(`habit card "${habit.name}"`);
        router.push({ pathname: '/habit/[id]', params: { id: habit.id } });
      }}>
      <Card style={[styles.card, restDay && styles.dimmed]}>
        <View style={[Common.row, styles.gap]}>
          <IconBubble icon={habit.icon} color={habit.color} />
          <View style={[Common.flex, styles.texts]}>
            <Txt variant="heading" numberOfLines={1}>
              {habit.name}
            </Txt>
            <Txt variant="note" tone="textSecondary" numberOfLines={1}>
              {subtitle}
            </Txt>
          </View>
          <CheckButton
            done={state === 'done'}
            color={habit.color}
            onPress={onToggle}
            logLabel={`today "${habit.name}"`}
          />
        </View>

        <View style={[Common.spread, styles.dots]}>
          {last7.map((day) => {
            const key = toKey(day);
            const dotState = dayState(habit, log, key, today);
            // Days before the habit existed look like rest days, so the row stays complete.
            const colors = dayColors(dotState === 'before' ? 'off' : dotState, habit.color, theme);
            return (
              <View key={key} style={styles.dotColumn}>
                <Animated.View
                  style={[
                    Common.circle,
                    styles.dot,
                    colorTransition,
                    { backgroundColor: colors.fill, borderColor: colors.border },
                  ]}
                />
                <Txt variant="micro" tone={key === today ? 'text' : 'textMuted'}>
                  {WEEKDAY_LETTER[day.getDay()]}
                </Txt>
              </View>
            );
          })}
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  dimmed: { opacity: 0.6 },
  gap: { gap: Spacing.three },
  texts: { gap: 2 },
  dots: { paddingHorizontal: Spacing.one },
  dotColumn: { alignItems: 'center', gap: Spacing.one },
  dot: { width: 14, height: 14, borderWidth: 1.5 },
});
