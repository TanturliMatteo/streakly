/**
 * Background task for the home-screen widgets: (re)draws them and handles taps on a check.
 * Runs in the app's JS runtime, also when the app's UI is closed.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { logEvent } from '@/lib/debug-log';

import { toggleInApp } from './bridge';
import { redrawAllWidgets, renderWidgetFor, TOGGLE_ACTION } from './habit-widgets';
import { readSnapshot, toggleInStorage } from './snapshot';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction, clickActionData } = props;
  if (widgetAction === 'WIDGET_DELETED') return;

  try {
    if (widgetAction === 'WIDGET_CLICK' && clickAction === TOGGLE_ACTION) {
      const id = clickActionData?.id;
      if (typeof id !== 'string') {
        logEvent('error', `widget: check without a habit id (${JSON.stringify(clickActionData)})`);
        return;
      }
      // App running: its store saves the change and redraws all widgets.
      if (toggleInApp(id)) return;
      // Redraws this widget and any other placed copy in one pass.
      await redrawAllWidgets(await toggleInStorage(id));
      return;
    }
    // Added, periodic update (also picks up a new day), resize, or other taps.
    props.renderWidget(renderWidgetFor(widgetInfo, await readSnapshot()));
  } catch (e) {
    logEvent('error', `widget ${widgetInfo.widgetName} ${widgetAction} failed: ${String(e)}`);
    props.renderWidget(renderWidgetFor(widgetInfo, null));
  }
}
