/**
 * Data access for the widget task (which may run while the app's UI is closed): reads what the
 * app saved, and applies a widget check directly to storage when the app isn't running.
 */
import { toKey } from '@/lib/dates';
import { logEvent } from '@/lib/debug-log';
import { toggleToday } from '@/lib/habit-data';
import { loadItem, saveItem } from '@/lib/storage';
import { HABITS_KEY, SETTINGS_KEY } from '@/lib/storage-keys';
import { DEFAULT_SETTINGS, parseHabitsData, parseSettings, type HabitsData, type ThemePreference } from '@/lib/validate';

export type WidgetSnapshot = { data: HabitsData; theme: ThemePreference; today: string };

async function readTheme(): Promise<ThemePreference> {
  try {
    const raw = await loadItem(SETTINGS_KEY);
    return raw ? parseSettings(raw).value.theme : DEFAULT_SETTINGS.theme;
  } catch (e) {
    logEvent('error', `widget: reading settings failed: ${String(e)}`);
    return DEFAULT_SETTINGS.theme;
  }
}

/**
 * Reads the saved data. `clean` is false when the stored data needed repairs: the widget may show
 * it, but must not write it back (the app backs it up and repairs it on its next start).
 */
async function readData(today: string): Promise<{ data: HabitsData; clean: boolean } | null> {
  try {
    const raw = await loadItem(HABITS_KEY);
    if (!raw) return { data: { habits: [], logs: {} }, clean: true };
    const { value, problems } = parseHabitsData(raw, today);
    problems.forEach((p) => logEvent('error', `widget: ${p}`));
    return { data: value, clean: problems.length === 0 };
  } catch (e) {
    logEvent('error', `widget: reading habits failed: ${String(e)}`);
    return null;
  }
}

/** Null when the habits can't be read (the widget then shows an error state). */
export async function readSnapshot(): Promise<WidgetSnapshot | null> {
  const today = toKey(new Date());
  const [result, theme] = await Promise.all([readData(today), readTheme()]);
  return result && { data: result.data, theme, today };
}

/** Toggles today's check for a habit in storage. Returns the new snapshot, or null on failure. */
export async function toggleInStorage(habitId: string): Promise<WidgetSnapshot | null> {
  const today = toKey(new Date());
  const [result, theme] = await Promise.all([readData(today), readTheme()]);
  if (!result) return null;
  if (!result.clean || !result.data.habits.some((h) => h.id === habitId)) {
    logEvent('error', `widget: check for ${habitId} not saved (unknown habit or damaged data)`);
    return { data: result.data, theme, today };
  }
  const data = toggleToday(result.data, habitId, today);
  try {
    await saveItem(HABITS_KEY, JSON.stringify(data));
    logEvent('action', `widget check ${habitId} saved (app closed)`);
    return { data, theme, today };
  } catch (e) {
    logEvent('error', `widget: saving check failed: ${String(e)}`);
    return { data: result.data, theme, today };
  }
}
