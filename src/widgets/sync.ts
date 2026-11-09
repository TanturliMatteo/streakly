import type { WidgetToggle } from '@/lib/habit-data';
import type { HabitsData, ThemePreference } from '@/lib/validate';

/** The home-screen widget is Android only (see sync.android.ts). */
export function updateWidgets(_data: HabitsData, _theme: ThemePreference) {}

export function takeWidgetToggles(): WidgetToggle[] {
  return [];
}
