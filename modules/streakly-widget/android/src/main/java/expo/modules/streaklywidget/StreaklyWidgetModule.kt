package expo.modules.streaklywidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS bridge: the app hands over its data and collects the checks made in the widget. */
class StreaklyWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StreaklyWidget")

    /** Saves `{ theme, data }` for the widget and redraws it. */
    Function("setData") { json: String ->
      val context = appContext.reactContext
      if (context != null) {
        WidgetStore.setData(context, json)
        StreaklyWidgetProvider.updateAll(context)
      }
    }

    /** Widget checks not yet applied by the app (JSON `[{ id, date, done }]`); clears them. */
    Function("takeToggles") {
      appContext.reactContext?.let { WidgetStore.takePending(it) } ?: "[]"
    }
  }
}
