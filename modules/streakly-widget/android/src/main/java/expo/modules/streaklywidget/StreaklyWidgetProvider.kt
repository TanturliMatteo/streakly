package expo.modules.streaklywidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log

/**
 * "Today's habits" home-screen widget. Laid out natively by the launcher, so resizing and
 * scrolling behave like any Android widget. Refreshed by the app on every save, every 30 min by
 * the system (picks up a new day), and right away after a check in the widget.
 */
class StreaklyWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
    widgetIds.forEach { WidgetViews.render(context, manager, it) }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action != WidgetViews.ACTION_ROW) return
    val habitId = intent.getStringExtra(WidgetViews.EXTRA_HABIT) ?: return
    when (intent.getStringExtra(WidgetViews.EXTRA_KIND)) {
      WidgetViews.KIND_TOGGLE -> {
        WidgetStore.toggleToday(context, habitId)
        updateAll(context)
      }
      WidgetViews.KIND_OPEN -> openHabit(context, habitId)
    }
  }

  /** Opens the habit's page in the app (same deep link the app handles: habitsapp://habit/<id>). */
  private fun openHabit(context: Context, habitId: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("habitsapp://habit/${Uri.encode(habitId)}"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (e: Exception) {
      Log.w("StreaklyWidget", "opening habit failed", e)
    }
  }

  companion object {
    /** Redraws every placed widget. */
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, StreaklyWidgetProvider::class.java))
      ids.forEach { WidgetViews.render(context, manager, it) }
    }
  }
}
