/** Pure operations on the whole habits data, shared by the app store and the home-screen widgets. */
import { currentStreak, dayState } from './habit-utils';
import type { DayState, DayStatus, Habit } from './types';
import type { HabitsData } from './validate';

export function withStatus(data: HabitsData, id: string, dateKey: string, status: DayStatus | null): HabitsData {
  const log = { ...(data.logs[id] ?? {}) };
  if (status) log[dateKey] = status;
  else delete log[dateKey];
  return { ...data, logs: { ...data.logs, [id]: log } };
}

/** Today's check toggled: done ↔ not done (cleared). */
export function toggleToday(data: HabitsData, id: string, today: string): HabitsData {
  const done = data.logs[id]?.[today] === 'done';
  return withStatus(data, id, today, done ? null : 'done');
}

export type TodayItem = { habit: Habit; state: DayState; streak: number };

/** Habits due today (rest days excluded), in the user's order, with the counts. */
export function dueToday(data: HabitsData, today: string): { items: TodayItem[]; done: number } {
  const items: TodayItem[] = [];
  let done = 0;
  for (const habit of data.habits) {
    const log = data.logs[habit.id] ?? {};
    const state = dayState(habit, log, today, today);
    if (state === 'off' || state === 'before' || state === 'future') continue;
    if (state === 'done') done++;
    items.push({ habit, state, streak: currentStreak(habit, log, today) });
  }
  return { items, done };
}
