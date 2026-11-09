/**
 * Link with the native home-screen widget (modules/streakly-widget).
 *
 * The widget keeps its own copy of the data, so it works while the app is closed. A check made in
 * the widget is shown there at once and queued; the app applies the queue when it starts or comes
 * back to the foreground (`takeWidgetToggles`), then saves, which refreshes the widget's copy.
 */
import StreaklyWidget from '../../modules/streakly-widget';

import { logEvent } from '@/lib/debug-log';
import type { WidgetToggle } from '@/lib/habit-data';
import type { HabitsData, ThemePreference } from '@/lib/validate';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Gives the widget the app's current (just saved) data and redraws it. */
export function updateWidgets(data: HabitsData, theme: ThemePreference) {
  if (!StreaklyWidget) return; // build without the widget module
  try {
    StreaklyWidget.setData(JSON.stringify({ theme, data }));
  } catch (e) {
    logEvent('error', `widget: updating failed: ${String(e)}`);
  }
}

/** Checks made in the widget since the last call (validated: the queue is stored outside the app). */
export function takeWidgetToggles(): WidgetToggle[] {
  if (!StreaklyWidget) return [];
  try {
    const raw: unknown = JSON.parse(StreaklyWidget.takeToggles());
    if (!Array.isArray(raw)) throw new Error('not a list');
    const toggles = raw.filter(
      (t): t is WidgetToggle =>
        typeof t === 'object' &&
        t !== null &&
        typeof t.id === 'string' &&
        typeof t.date === 'string' &&
        DATE_KEY.test(t.date) &&
        typeof t.done === 'boolean',
    );
    if (toggles.length !== raw.length) logEvent('error', `widget: ${raw.length - toggles.length} invalid check(s) dropped`);
    return toggles;
  } catch (e) {
    logEvent('error', `widget: reading checks failed: ${String(e)}`);
    return [];
  }
}
