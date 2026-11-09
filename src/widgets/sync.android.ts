import { toKey } from '@/lib/dates';
import type { HabitsData, ThemePreference } from '@/lib/validate';

import { redrawAllWidgets } from './habit-widgets';

/** Redraws every placed widget with the app's current (just saved) data. */
export function updateWidgets(data: HabitsData, theme: ThemePreference) {
  void redrawAllWidgets({ data, theme, today: toKey(new Date()) });
}
