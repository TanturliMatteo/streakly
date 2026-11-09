/** Pure operations on the whole habits data, shared by the app store and the home-screen widgets. */
import { currentStreak, dayState, isDue } from './habit-utils';
import type { DayState, DayStatus, Habit } from './types';
import type { HabitsData } from './validate';

export function withStatus(data: HabitsData, id: string, dateKey: string, status: DayStatus | null): HabitsData {
  const log = { ...(data.logs[id] ?? {}) };
  if (status) log[dateKey] = status;
  else delete log[dateKey];
  return { ...data, logs: { ...data.logs, [id]: log } };
}

/** A check made in the home-screen widget: `date` set to done, or cleared. */
export type WidgetToggle = { id: string; date: string; done: boolean };

/** Applies the widget's checks in order (unknown habits are skipped). */
export function applyWidgetToggles(data: HabitsData, toggles: WidgetToggle[]): HabitsData {
  return toggles.reduce(
    (d, t) => (d.habits.some((h) => h.id === t.id) ? withStatus(d, t.id, t.date, t.done ? 'done' : null) : d),
    data,
  );
}

export type TodayItem = { habit: Habit; state: DayState; streak: number };

/** Habits due today (rest days excluded), in the user's order, with the counts. */
export function dueToday(data: HabitsData, today: string): { items: TodayItem[]; done: number } {
  const items: TodayItem[] = [];
  let done = 0;
  for (const habit of data.habits) {
    const log = data.logs[habit.id] ?? {};
    const state = dayState(habit, log, today, today);
    if (!isDue(state)) continue;
    if (state === 'done') done++;
    items.push({ habit, state, streak: currentStreak(habit, log, today) });
  }
  return { items, done };
}

/** True when at least one habit is due today and every due habit is done. */
export function allDoneToday(data: HabitsData, today: string) {
  let due = 0;
  for (const habit of data.habits) {
    const state = dayState(habit, data.logs[habit.id] ?? {}, today, today);
    if (!isDue(state)) continue;
    if (state !== 'done') return false;
    due++;
  }
  return due > 0;
}
