/**
 * Validation of data read back from storage. Stored JSON is untrusted: it may be corrupt, from
 * an older app version, or edited by hand. Parsers repair what they safely can, drop what they
 * can't, and report every problem so nothing is fixed silently.
 */
import { HabitColors, HabitIcons } from '@/constants/theme';

import type { DayStatus, Frequency, Habit, HabitLog, ReminderSettings, ReminderTime, Weekday } from './types';

export type HabitsData = { habits: Habit[]; logs: Record<string, HabitLog> };

export type Parsed<T> = {
  value: T;
  /** Human-readable list of what was repaired or dropped (empty when the data was clean). */
  problems: string[];
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function parseTime(v: unknown): ReminderTime | null {
  return isObj(v) && isInt(v.hour, 0, 23) && isInt(v.minute, 0, 59) ? { hour: v.hour, minute: v.minute } : null;
}

function parseFrequency(v: unknown, problems: string[], label: string): Frequency {
  if (isObj(v) && v.type === 'daily') return { type: 'daily' };
  if (isObj(v) && v.type === 'weekly' && Array.isArray(v.days)) {
    const days = [...new Set(v.days.filter((d): d is Weekday => isInt(d, 0, 6)))];
    if (days.length === v.days.length && days.length > 0) return { type: 'weekly', days };
    if (days.length > 0) {
      problems.push(`${label}: invalid weekdays removed`);
      return { type: 'weekly', days };
    }
  }
  problems.push(`${label}: invalid frequency, reset to every day`);
  return { type: 'daily' };
}

function parseReminder(v: unknown, problems: string[], label: string): ReminderSettings {
  if (!isObj(v) || typeof v.enabled !== 'boolean' || !Array.isArray(v.times)) {
    problems.push(`${label}: invalid reminder settings, reminders turned off`);
    return { enabled: false, times: [{ hour: 9, minute: 0 }] };
  }
  const times = v.times.map(parseTime).filter((t): t is ReminderTime => t !== null);
  if (times.length !== v.times.length) problems.push(`${label}: invalid reminder times removed`);
  if (times.length === 0) {
    if (v.enabled) problems.push(`${label}: no valid reminder time, reminders turned off`);
    return { enabled: false, times: [{ hour: 9, minute: 0 }] };
  }
  return { enabled: v.enabled, times };
}

function parseHabit(v: unknown, index: number, today: string, problems: string[]): Habit | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id || typeof v.name !== 'string' || !v.name.trim()) {
    problems.push(`habit #${index + 1}: missing id or name, dropped`);
    return null;
  }
  const label = `habit "${v.name}"`;
  const pick = <T>(ok: boolean, value: T, fallback: T, field: string): T => {
    if (ok) return value;
    problems.push(`${label}: invalid ${field}, reset`);
    return fallback;
  };
  return {
    id: v.id,
    name: v.name,
    description: pick(typeof v.description === 'string', v.description as string, '', 'description'),
    icon: pick(typeof v.icon === 'string' && v.icon.length > 0, v.icon as string, HabitIcons[0], 'icon'),
    color: pick(typeof v.color === 'string' && HEX_COLOR.test(v.color), v.color as string, HabitColors[0], 'color'),
    frequency: parseFrequency(v.frequency, problems, label),
    reminder: parseReminder(v.reminder, problems, label),
    createdAt: pick(typeof v.createdAt === 'string' && DATE_KEY.test(v.createdAt), v.createdAt as string, today, 'creation date'),
    notificationIds: pick(
      Array.isArray(v.notificationIds) && v.notificationIds.every((n) => typeof n === 'string'),
      v.notificationIds as string[],
      [],
      'notification ids',
    ),
  };
}

function parseLog(v: unknown, problems: string[], label: string): HabitLog {
  if (v === undefined) return {};
  if (!isObj(v)) {
    problems.push(`${label}: invalid history, reset`);
    return {};
  }
  const log: HabitLog = {};
  let bad = 0;
  for (const [key, status] of Object.entries(v)) {
    if (DATE_KEY.test(key) && (status === 'done' || status === 'missed')) log[key] = status as DayStatus;
    else bad++;
  }
  if (bad > 0) problems.push(`${label}: ${bad} invalid history entr${bad === 1 ? 'y' : 'ies'} removed`);
  return log;
}

/**
 * Parses the stored habits blob. Throws if it isn't usable at all (not JSON, wrong root shape);
 * otherwise returns the repaired data plus the list of problems found.
 */
export function parseHabitsData(raw: string, today: string): Parsed<HabitsData> {
  const root: unknown = JSON.parse(raw);
  if (!isObj(root) || !Array.isArray(root.habits)) throw new Error('stored habits have an unknown shape');

  const problems: string[] = [];
  const rawLogs = isObj(root.logs) ? root.logs : {};
  if (root.logs !== undefined && !isObj(root.logs)) problems.push('history: invalid, reset');

  const habits: Habit[] = [];
  const logs: Record<string, HabitLog> = {};
  const seen = new Set<string>();
  root.habits.forEach((v, i) => {
    const habit = parseHabit(v, i, today, problems);
    if (!habit) return;
    if (seen.has(habit.id)) {
      problems.push(`habit "${habit.name}": duplicate id, dropped`);
      return;
    }
    seen.add(habit.id);
    habits.push(habit);
    logs[habit.id] = parseLog(rawLogs[habit.id], problems, `habit "${habit.name}"`);
  });
  return { value: { habits, logs }, problems };
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type Settings = { theme: ThemePreference; reminders: boolean };
export const DEFAULT_SETTINGS: Settings = { theme: 'system', reminders: true };

/** Parses stored settings; unknown or invalid fields fall back to the defaults. Throws on bad JSON. */
export function parseSettings(raw: string): Parsed<Settings> {
  const root: unknown = JSON.parse(raw);
  const problems: string[] = [];
  if (!isObj(root)) return { value: DEFAULT_SETTINGS, problems: ['settings: unknown shape, reset'] };
  const theme =
    root.theme === 'system' || root.theme === 'light' || root.theme === 'dark' ? root.theme : undefined;
  if (root.theme !== undefined && !theme) problems.push('settings: invalid theme, reset');
  const reminders = typeof root.reminders === 'boolean' ? root.reminders : undefined;
  if (root.reminders !== undefined && reminders === undefined) problems.push('settings: invalid reminders, reset');
  return {
    value: { theme: theme ?? DEFAULT_SETTINGS.theme, reminders: reminders ?? DEFAULT_SETTINGS.reminders },
    problems,
  };
}
