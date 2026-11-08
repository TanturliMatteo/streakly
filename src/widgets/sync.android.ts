import { requestWidgetUpdate } from 'react-native-android-widget';

import { toKey } from '@/lib/dates';
import { logEvent } from '@/lib/debug-log';
import type { HabitsData, ThemePreference } from '@/lib/validate';

import { renderWidgetFor, WIDGET_NAMES } from './habit-widgets';

/** Redraws every placed widget with the app's current (just saved) data. */
export function updateWidgets(data: HabitsData, theme: ThemePreference) {
  const snapshot = { data, theme, today: toKey(new Date()) };
  for (const widgetName of WIDGET_NAMES) {
    requestWidgetUpdate({ widgetName, renderWidget: (info) => renderWidgetFor(info, snapshot) }).catch((e) =>
      logEvent('error', `widget: updating ${widgetName} failed: ${String(e)}`),
    );
  }
}
