/**
 * Background task for the home-screen widgets: (re)draws them and handles taps on a check.
 * Runs in the app's JS runtime, also when the app's UI is closed.
 */
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';

import { logEvent } from '@/lib/debug-log';

import { toggleInApp } from './bridge';
import { renderWidgetFor, TOGGLE_ACTION, WIDGET_NAMES } from './habit-widgets';
import { readSnapshot, toggleInStorage, type WidgetSnapshot } from './snapshot';

/** Redraws every placed widget (e.g. the ring after a check in the list). */
async function refreshAll(snapshot: WidgetSnapshot | null) {
  for (const widgetName of WIDGET_NAMES) {
    await requestWidgetUpdate({ widgetName, renderWidget: (info) => renderWidgetFor(info, snapshot) }).catch((e) =>
      logEvent('error', `widget: refreshing ${widgetName} failed: ${String(e)}`),
    );
  }
}

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
      const snapshot = await toggleInStorage(id);
      props.renderWidget(renderWidgetFor(widgetInfo, snapshot));
      await refreshAll(snapshot);
      return;
    }
    // Added, periodic update (also picks up a new day), resize, or other taps.
    props.renderWidget(renderWidgetFor(widgetInfo, await readSnapshot()));
  } catch (e) {
    logEvent('error', `widget ${widgetInfo.widgetName} ${widgetAction} failed: ${String(e)}`);
    props.renderWidget(renderWidgetFor(widgetInfo, null));
  }
}
