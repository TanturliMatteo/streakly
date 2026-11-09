import { addDays, ALL_DAYS, describeDays, fromKey, startOfWeek, toKey } from './dates';
import type { DayState, Habit, HabitLog, Weekday } from './types';

export function habitDays(habit: Habit): Weekday[] {
  return habit.frequency.type === 'daily' ? ALL_DAYS : habit.frequency.days;
}

function isScheduled(habit: Habit, date: Date) {
  return habitDays(habit).includes(date.getDay() as Weekday);
}

export function describeFrequency(habit: Habit) {
  return describeDays(habitDays(habit));
}

export function dayState(habit: Habit, log: HabitLog, key: string, today: string): DayState {
  if (key < habit.createdAt) return 'before';
  if (key > today) return 'future';
  const recorded = log[key];
  if (recorded) return recorded;
  if (!isScheduled(habit, fromKey(key))) return 'off';
  return key === today ? 'pending' : 'missed';
}

/** Whether a day in this state counts towards the day's progress (not a rest day, not outside the habit's life). */
export function isDue(state: DayState) {
  return state === 'done' || state === 'pending' || state === 'missed';
}

/** Card / widget subtitle: the running streak, or the description as a nudge to start one. */
export function streakSubtitle(habit: Habit, streak: number) {
  return streak > 0 ? `🔥 ${streak} day streak` : habit.description || 'Start your streak today';
}

/** Max days walked back when back-filling, so a long-idle app stays fast. */
const MAX_BACKFILL_DAYS = 730;

/**
 * Every scheduled day before today with no entry is recorded as "missed".
 * Returns the same object when nothing changed.
 */
export function backfill(habit: Habit, log: HabitLog, today: string): HabitLog {
  let next: HabitLog | null = null;
  let d = addDays(fromKey(today), -1);
  for (let i = 0; i < MAX_BACKFILL_DAYS; i++, d = addDays(d, -1)) {
    const key = toKey(d);
    if (key < habit.createdAt) break;
    if (!log[key] && isScheduled(habit, d)) {
      next ??= { ...log };
      next[key] = 'missed';
    }
  }
  return next ?? log;
}

/**
 * Consecutive "done" days ending today (or yesterday, if today isn't checked yet).
 * Same result as `getStats(...).currentStreak`, but walks back only as far as the streak goes,
 * so it's cheap enough to run on every home-screen card.
 */
export function currentStreak(habit: Habit, log: HabitLog, today: string): number {
  let streak = 0;
  for (let d = fromKey(today); ; d = addDays(d, -1)) {
    const state = dayState(habit, log, toKey(d), today);
    if (state === 'done') streak++;
    else if (state === 'missed' || state === 'before') return streak;
    // 'off' and 'pending' (today, not yet done) don't break the streak.
  }
}

type HabitStats = {
  currentStreak: number;
  bestStreak: number;
  completionRate: number; // 0–1
};

export function getStats(habit: Habit, log: HabitLog, today: string): HabitStats {
  // Walk from creation to today, counting only scheduled days (or days explicitly marked done).
  let run = 0;
  let best = 0;
  let done = 0;
  let missed = 0;
  let d = fromKey(habit.createdAt);
  const end = fromKey(today);
  while (d <= end) {
    const key = toKey(d);
    const state = dayState(habit, log, key, today);
    if (state === 'done') {
      run++;
      done++;
      best = Math.max(best, run);
    } else if (state === 'missed') {
      run = 0;
      missed++;
    }
    // 'off' and 'pending' (today, not yet done) don't break the streak.
    d = addDays(d, 1);
  }
  return {
    currentStreak: run,
    bestStreak: best,
    completionRate: done + missed === 0 ? 0 : done / (done + missed),
  };
}

export type WeekBucket = { start: Date; rate: number | null; done: number; total: number };

/** Completion rate for each of the last `weeks` weeks (Monday-based), oldest first. */
export function weeklyRates(habit: Habit, log: HabitLog, today: string, weeks: number): WeekBucket[] {
  const thisWeek = startOfWeek(fromKey(today));
  const buckets: WeekBucket[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w);
    let done = 0;
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const state = dayState(habit, log, toKey(addDays(start, i)), today);
      if (state === 'done') {
        done++;
        total++;
      } else if (state === 'missed') {
        total++;
      }
    }
    buckets.push({ start, done, total, rate: total === 0 ? null : done / total });
  }
  return buckets;
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
