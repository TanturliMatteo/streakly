import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { logEvent } from './debug-log';
import { toKey } from './dates';
import { backfill, dayState, newId } from './habit-utils';
import { cancelReminders, scheduleHabitReminders } from './notifications';
import { loadItem, saveItem } from './storage';
import type { DayStatus, Habit, HabitInput, HabitLog } from './types';

const STORAGE_KEY = 'habits-app/v1';

type Data = { habits: Habit[]; logs: Record<string, HabitLog> };

/** The habit is always saved; `reminderError` is set if its notifications could not be scheduled. */
export type SaveResult = { reminderError?: string };

type HabitsContextValue = Data & {
  ready: boolean;
  /** Today's date key; updates at midnight and when the app returns to foreground. */
  today: string;
  addHabit: (input: HabitInput) => Promise<SaveResult>;
  updateHabit: (id: string, input: HabitInput) => Promise<SaveResult>;
  deleteHabit: (id: string) => Promise<void>;
  /** `null` clears the entry (only meaningful for today; past days get back-filled as missed). */
  setStatus: (id: string, dateKey: string, status: DayStatus | null) => void;
  /** Increments each time a status change completes every habit due today (drives the confetti). */
  celebration: number;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

function withStatus(data: Data, id: string, dateKey: string, status: DayStatus | null): Data {
  const log = { ...(data.logs[id] ?? {}) };
  if (status) log[dateKey] = status;
  else delete log[dateKey];
  return { ...data, logs: { ...data.logs, [id]: log } };
}

/** True when at least one habit is due today and every due habit is done. */
function allDoneToday(data: Data, today: string) {
  const states = data.habits.map((h) => dayState(h, data.logs[h.id] ?? {}, today, today));
  const due = states.filter((s) => s !== 'off');
  return due.length > 0 && due.every((s) => s === 'done');
}

function backfillAll(data: Data, today: string): Data {
  let changed = false;
  const logs = { ...data.logs };
  for (const habit of data.habits) {
    const before = logs[habit.id] ?? {};
    const after = backfill(habit, before, today);
    if (after !== before || !logs[habit.id]) {
      logs[habit.id] = after;
      changed = true;
    }
  }
  return changed ? { ...data, logs } : data;
}

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>({ habits: [], logs: {} });
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => toKey(new Date()));
  const [celebration, setCelebration] = useState(0);

  // Load once. Unchecked scheduled days from the past become "not done".
  useEffect(() => {
    loadItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setData(backfillAll(JSON.parse(raw) as Data, toKey(new Date())));
      })
      .catch((e) => console.warn('Failed to load habits', e))
      .finally(() => setReady(true));
  }, []);

  // Keep "today" fresh (on foreground and at midnight) and back-fill the day that just ended.
  useEffect(() => {
    const refresh = () => {
      const key = toKey(new Date());
      setToday(key);
      setData((d) => backfillAll(d, key));
    };
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [today]);

  // Persist.
  useEffect(() => {
    if (ready) saveItem(STORAGE_KEY, JSON.stringify(data)).catch((e) => console.warn(e));
  }, [data, ready]);

  async function addHabit(input: HabitInput): Promise<SaveResult> {
    const draft: Habit = { ...input, id: newId(), createdAt: today, notificationIds: [] };
    logEvent('action', `addHabit ${JSON.stringify({ ...input, description: undefined })}`);
    const { ids, error } = await scheduleHabitReminders(draft);
    const habit = { ...draft, notificationIds: ids };
    setData((d) => ({ habits: [...d.habits, habit], logs: { ...d.logs, [habit.id]: {} } }));
    return { reminderError: error };
  }

  async function updateHabit(id: string, input: HabitInput): Promise<SaveResult> {
    const existing = data.habits.find((h) => h.id === id);
    if (!existing) return {};
    logEvent('action', `updateHabit ${id} ${JSON.stringify({ ...input, description: undefined })}`);
    await cancelReminders(existing.notificationIds);
    const draft: Habit = { ...existing, ...input, notificationIds: [] };
    const { ids, error } = await scheduleHabitReminders(draft);
    const habit = { ...draft, notificationIds: ids };
    setData((d) => {
      const next = { ...d, habits: d.habits.map((h) => (h.id === id ? habit : h)) };
      return backfillAll(next, today);
    });
    return { reminderError: error };
  }

  async function deleteHabit(id: string) {
    const existing = data.habits.find((h) => h.id === id);
    logEvent('action', `deleteHabit ${id} "${existing?.name}"`);
    if (existing) await cancelReminders(existing.notificationIds);
    setData((d) => {
      const { [id]: _removed, ...logs } = d.logs;
      return { habits: d.habits.filter((h) => h.id !== id), logs };
    });
  }

  function setStatus(id: string, dateKey: string, status: DayStatus | null) {
    logEvent('action', `setStatus ${id} ${dateKey} → ${status ?? 'cleared'}`);
    // Completion is detected here, so it works wherever the habit was checked (card or calendar).
    if (!allDoneToday(data, today) && allDoneToday(withStatus(data, id, dateKey, status), today)) {
      logEvent('action', 'all habits done today → confetti');
      setCelebration((c) => c + 1);
    }
    setData((d) => withStatus(d, id, dateKey, status));
  }

  return (
    <HabitsContext
      value={{ ...data, ready, today, addHabit, updateHabit, deleteHabit, setStatus, celebration }}>
      {children}
    </HabitsContext>
  );
}

export function useHabits() {
  const ctx = use(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used inside <HabitsProvider>');
  return ctx;
}

export function useHabit(id: string | undefined) {
  const ctx = useHabits();
  const habit = ctx.habits.find((h) => h.id === id);
  return { ...ctx, habit, log: (id && ctx.logs[id]) || {} };
}
