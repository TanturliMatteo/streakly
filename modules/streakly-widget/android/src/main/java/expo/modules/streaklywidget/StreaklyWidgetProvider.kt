package expo.modules.streaklywidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import java.util.Calendar

/**
 * "Today's habits" home-screen widget. Laid out natively by the launcher, so resizing and
 * scrolling behave like any Android widget. Redrawn by the app on every save, right away after a
 * check in the widget, at midnight (new day), when the clock or time zone changes, and every
 * 30 min by the system as a fallback.
 */
class StreaklyWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, widgetIds: IntArray) {
    widgetIds.forEach { WidgetViews.render(context, manager, it) }
    scheduleMidnight(context)
  }

  /** Last widget removed: no more midnight redraws. */
  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    context.getSystemService(AlarmManager::class.java)?.cancel(midnightIntent(context))
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_MIDNIGHT, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> {
        updateAll(context)
        return
      }
      WidgetViews.ACTION_ROW -> {}
      else -> return
    }
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
    private const val ACTION_MIDNIGHT = "expo.modules.streaklywidget.MIDNIGHT"
    /** How late the midnight redraw may run. A window (not an exact alarm) needs no permission. */
    private const val MIDNIGHT_WINDOW_MS = 60_000L

    /** Redraws every placed widget. */
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, StreaklyWidgetProvider::class.java))
      if (ids.isEmpty()) return
      ids.forEach { WidgetViews.render(context, manager, it) }
      scheduleMidnight(context)
    }

    /**
     * Redraw just after the next midnight, so the new day's habits show up. Non-wakeup: if the
     * phone is asleep it runs when the screen turns on, which is when the widget can be seen.
     * Re-scheduling replaces the previous alarm (same PendingIntent).
     */
    private fun scheduleMidnight(context: Context) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val next = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_MONTH, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 5)
        set(Calendar.MILLISECOND, 0)
      }
      alarms.setWindow(AlarmManager.RTC, next.timeInMillis, MIDNIGHT_WINDOW_MS, midnightIntent(context))
    }

    private fun midnightIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, StreaklyWidgetProvider::class.java).setAction(ACTION_MIDNIGHT),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
  }
}
