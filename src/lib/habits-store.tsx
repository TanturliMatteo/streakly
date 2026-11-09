import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { setWidgetToggleHandler } from '@/widgets/bridge';
import { updateWidgets } from '@/widgets/sync';

import { toKey } from './dates';
import { logEvent } from './debug-log';
import { allDoneToday, withStatus } from './habit-data';
import { backfill, newId } from './habit-utils';
import { cancelReminders, scheduleHabitReminders } from './notifications';
import { useSettings } from './settings-store';
import { loadItem, saveItem } from './storage';
import { HABITS_KEY } from './storage-keys';
import type { DayStatus, Habit, HabitInput, ScheduleResult } from './types';
import { parseHabitsData, type HabitsData } from './validate';

/**
 * Problem found while loading:
 * - `repaired`: some stored data was invalid and was fixed or dropped (the original is backed up).
 * - `unreadable`: storage couldn't be read; saving is disabled for this session to protect it.
 */
export type LoadIssue = 'repaired' | 'unreadable';

/** The habit is always saved; `reminderError` is set if its notifications could not be scheduled. */
export type SaveResult = { reminderError?: string };

type HabitsContextValue = HabitsData & {
  ready: boolean;
  loadIssue: LoadIssue | null;
  /** Today's date key; updates at midnight and when the app returns to foreground. */
  today: string;
  addHabit: (input: HabitInput) => Promise<SaveResult>;
  updateHabit: (id: string, input: HabitInput) => Promise<SaveResult>;
  deleteHabit: (id: string) => Promise<void>;
  /** `null` clears the entry (only meaningful for today; past days get back-filled as missed). */
  setStatus: (id: string, dateKey: string, status: DayStatus | null) => void;
  /**
   * New order for some habits (e.g. one group of the home list). They swap places among the
   * slots they already occupy, so habits not in `ids` keep their positions.
   */
  reorderHabits: (ids: string[]) => void;
  /** Master switch: cancels every reminder, or schedules them all again. */
  setRemindersEnabled: (enabled: boolean) => Promise<SaveResult>;
  /** Increments each time a status change completes every habit due today (drives the confetti). */
  celebration: number;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

function backfillAll(data: HabitsData, today: string): HabitsData {
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
  const [data, setData] = useState<HabitsData>({ habits: [], logs: {} });
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => toKey(new Date()));
  const [celebration, setCelebration] = useState(0);
  const [loadIssue, setLoadIssue] = useState<LoadIssue | null>(null);
  const { settings, updateSettings } = useSettings();

  /** Schedules a habit's reminders, unless they are switched off for the whole app. */
  const schedule = async (habit: Habit): Promise<ScheduleResult> =>
    settings.reminders ? scheduleHabitReminders(habit) : { ids: [] };

  // Load once. Unchecked scheduled days from the past become "not done".
  // Stored data is validated; anything that has to be repaired or can't be read is first copied
  // to a backup key, so the user's data is never overwritten without a copy.
  useEffect(() => {
    async function load() {
      let raw: string | null;
      try {
        raw = await loadItem(HABITS_KEY);
      } catch (e) {
        // Storage itself failed: don't save anything this session, or we'd overwrite real data.
        logEvent('error', `reading habits failed, saving disabled: ${String(e)}`);
        setLoadIssue('unreadable');
        return;
      }
      if (!raw) return;

      const todayKey = toKey(new Date());
      let parsed: HabitsData | null = null;
      let problems: string[];
      try {
        const result = parseHabitsData(raw, todayKey);
        parsed = result.value;
        problems = result.problems;
      } catch (e) {
        problems = [`unusable data: ${String(e)}`];
      }
      if (problems.length > 0) {
        problems.forEach((p) => logEvent('error', `loading habits: ${p}`));
        try {
          await saveItem(`${HABITS_KEY}/backup-${Date.now()}`, raw);
        } catch (e) {
          logEvent('error', `backing up damaged habits failed, saving disabled: ${String(e)}`);
          setLoadIssue('unreadable');
          return;
        }
        setLoadIssue('repaired');
      }
      if (parsed) setData(backfillAll(parsed, todayKey));
    }

    load()
      .catch((e) => {
        logEvent('error', `loading habits failed, saving disabled: ${String(e)}`);
        setLoadIssue('unreadable');
      })
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

  // Persist (never after a failed read: the stored data may still be intact), then refresh the
  // home-screen widgets with the saved data (also when the theme changes).
  const canSave = ready && loadIssue !== 'unreadable';
  const theme = settings.theme;
  useEffect(() => {
    if (!canSave) return;
    saveItem(HABITS_KEY, JSON.stringify(data))
      .then(() => updateWidgets(data, theme))
      .catch((e) => logEvent('error', `saving habits failed: ${String(e)}`));
  }, [data, canSave, theme]);

  // While the app is running, a widget's check goes through the app's state (one source of truth:
  // otherwise the app would later overwrite the widget's change with its older copy).
  useEffect(() => {
    if (!canSave) return;
    setWidgetToggleHandler((id) => {
      if (!data.habits.some((h) => h.id === id)) return;
      logEvent('action', `widget check ${id}`);
      setStatus(id, today, data.logs[id]?.[today] === 'done' ? null : 'done');
    });
    return () => setWidgetToggleHandler(null);
  });

  async function addHabit(input: HabitInput): Promise<SaveResult> {
    const draft: Habit = { ...input, id: newId(), createdAt: today, notificationIds: [] };
    logEvent('action', `addHabit ${JSON.stringify({ ...input, description: undefined })}`);
    const { ids, error } = await schedule(draft);
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
    const { ids, error } = await schedule(draft);
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

  function reorderHabits(ids: string[]) {
    logEvent('action', `reorder ${ids.join(', ')}`);
    setData((d) => {
      const moved = new Set(ids);
      const byId = new Map(d.habits.map((h) => [h.id, h]));
      const habits = [...d.habits];
      let next = 0;
      d.habits.forEach((h, slot) => {
        if (moved.has(h.id)) habits[slot] = byId.get(ids[next++]) ?? h;
      });
      return { ...d, habits };
    });
  }

  async function setRemindersEnabled(enabled: boolean): Promise<SaveResult> {
    logEvent('action', `reminders (all habits) → ${enabled ? 'on' : 'off'}`);
    updateSettings({ reminders: enabled });
    const habits = data.habits;
    await Promise.all(habits.map((h) => cancelReminders(h.notificationIds)));
    const results: ScheduleResult[] = enabled
      ? await Promise.all(habits.map((h) => scheduleHabitReminders({ ...h, notificationIds: [] })))
      : habits.map(() => ({ ids: [] }));
    const idsById = new Map(habits.map((h, i) => [h.id, results[i].ids]));
    setData((d) => ({
      ...d,
      habits: d.habits.map((h) => ({ ...h, notificationIds: idsById.get(h.id) ?? h.notificationIds })),
    }));
    return { reminderError: results.find((r) => r.error)?.error };
  }

  return (
    <HabitsContext
      value={{
        ...data,
        ready,
        loadIssue,
        today,
        addHabit,
        updateHabit,
        deleteHabit,
        setStatus,
        reorderHabits,
        setRemindersEnabled,
        celebration,
      }}>
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
