import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './task-handler';

/** Home-screen widgets exist on Android only. */
export function registerWidgets() {
  registerWidgetTaskHandler(widgetTaskHandler);
}
