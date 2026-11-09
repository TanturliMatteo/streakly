package expo.modules.streaklywidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews

/** Builds the widget and its rows as native views (RemoteViews), so the launcher lays them out at the real size. */
object WidgetViews {
  /** Colours from src/constants/theme.ts (`Colors.light` / `Colors.dark`). Keep in sync. */
  private class Palette(
    val background: Int,
    val backgroundElement: Int,
    val text: Int,
    val textSecondary: Int,
    val textMuted: Int,
    val tint: Int,
  )

  private val LIGHT = Palette(
    background = Color.parseColor("#FFFFFF"),
    backgroundElement = Color.parseColor("#F0F0F3"),
    text = Color.parseColor("#000000"),
    textSecondary = Color.parseColor("#60646C"),
    textMuted = Color.parseColor("#B9BBC6"),
    tint = Color.parseColor("#5B5BD6"),
  )

  private val DARK = Palette(
    background = Color.parseColor("#000000"),
    backgroundElement = Color.parseColor("#1A1B1E"),
    text = Color.parseColor("#FFFFFF"),
    textSecondary = Color.parseColor("#B0B4BA"),
    textMuted = Color.parseColor("#5A5E66"),
    tint = Color.parseColor("#8B8DF8"),
  )

  /** `Alpha.soft` (0.14) of theme.ts, for the tinted icon bubble. */
  private const val SOFT_ALPHA = 36

  const val ACTION_ROW = "expo.modules.streaklywidget.ROW"
  const val EXTRA_KIND = "kind"
  const val EXTRA_HABIT = "habitId"
  const val KIND_OPEN = "open"
  const val KIND_TOGGLE = "toggle"

  /** Draws one placed widget. */
  fun render(context: Context, manager: AppWidgetManager, widgetId: Int) {
    val state = WidgetStore.readToday(context)
    val theme = state?.theme ?: "system"
    val views = RemoteViews(context.packageName, R.layout.streakly_widget)

    views.color(context, theme, R.id.streakly_bg, "setColorFilter") { it.background }
    views.color(context, theme, R.id.streakly_title, "setTextColor") { it.text }
    views.color(context, theme, R.id.streakly_empty, "setTextColor") { it.textSecondary }

    val due = state?.rows?.size ?: 0
    val done = state?.doneCount ?: 0
    if (due > 0) {
      views.setViewVisibility(R.id.streakly_count, View.VISIBLE)
      views.setTextViewText(R.id.streakly_count, "$done/$due")
      views.color(context, theme, R.id.streakly_count, "setTextColor") { if (done == due) it.tint else it.textSecondary }
    } else {
      views.setViewVisibility(R.id.streakly_count, View.GONE)
    }
    views.setTextViewText(
      R.id.streakly_empty,
      when {
        state == null -> "Couldn’t load your habits. Tap to open the app."
        !state.hasHabits -> "No habits yet. Tap to add one."
        else -> "Rest day, nothing due 🌙"
      },
    )

    // Header and empty message open the app.
    openAppIntent(context)?.let {
      views.setOnClickPendingIntent(R.id.streakly_header, it)
      views.setOnClickPendingIntent(R.id.streakly_empty, it)
    }

    // List rows: a tap on the texts opens the habit, a tap on the check toggles it.
    val template = Intent(context, StreaklyWidgetProvider::class.java).setAction(ACTION_ROW)
    views.setPendingIntentTemplate(
      R.id.streakly_list,
      PendingIntent.getBroadcast(
        context,
        widgetId,
        template,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      ),
    )
    val rows = state?.rows ?: emptyList()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val items = RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(true).setViewTypeCount(1)
      rows.forEach { items.addItem(it.id.hashCode().toLong(), row(context, theme, it)) }
      views.setRemoteAdapter(R.id.streakly_list, items.build())
    } else {
      // Older Android: rows come from StreaklyWidgetService. A new data URI per render makes the
      // launcher ask for fresh rows.
      val adapter = Intent(context, StreaklyWidgetService::class.java)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
      adapter.data = Uri.parse("streakly://widget/$widgetId/${System.currentTimeMillis()}")
      @Suppress("DEPRECATION")
      views.setRemoteAdapter(R.id.streakly_list, adapter)
    }
    views.setEmptyView(R.id.streakly_list, R.id.streakly_empty)

    manager.updateAppWidget(widgetId, views)
  }

  /** One habit card. */
  fun row(context: Context, theme: String, row: TodayRow): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.streakly_widget_row)
    views.color(context, theme, R.id.row_bg, "setColorFilter") { it.backgroundElement }
    views.setInt(R.id.row_icon_bg, "setColorFilter", row.color)
    views.setInt(R.id.row_icon_bg, "setImageAlpha", SOFT_ALPHA)
    views.setTextViewText(R.id.row_icon, row.icon)
    views.setTextViewText(R.id.row_name, row.name)
    views.color(context, theme, R.id.row_name, "setTextColor") { it.text }
    views.setTextViewText(R.id.row_subtitle, row.subtitle)
    views.color(context, theme, R.id.row_subtitle, "setTextColor") { it.textSecondary }

    if (row.done) {
      views.setViewVisibility(R.id.row_check_ring, View.GONE)
      views.setViewVisibility(R.id.row_check_fill, View.VISIBLE)
      views.setViewVisibility(R.id.row_check_mark, View.VISIBLE)
      views.setInt(R.id.row_check_fill, "setColorFilter", row.color)
    } else {
      views.setViewVisibility(R.id.row_check_ring, View.VISIBLE)
      views.setViewVisibility(R.id.row_check_fill, View.GONE)
      views.setViewVisibility(R.id.row_check_mark, View.GONE)
      views.color(context, theme, R.id.row_check_ring, "setColorFilter") { it.textMuted }
    }
    views.setContentDescription(R.id.row_check, if (row.done) "Mark ${row.name} not done" else "Mark ${row.name} done")

    views.setOnClickFillInIntent(
      R.id.row_open,
      Intent().putExtra(EXTRA_KIND, KIND_OPEN).putExtra(EXTRA_HABIT, row.id),
    )
    views.setOnClickFillInIntent(
      R.id.row_check,
      Intent().putExtra(EXTRA_KIND, KIND_TOGGLE).putExtra(EXTRA_HABIT, row.id),
    )
    return views
  }

  private fun openAppIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /**
   * Sets a theme colour. With the "system" theme on Android 12+ the launcher picks the light or
   * dark value itself, so the widget follows dark mode instantly; otherwise the colour is fixed.
   */
  private fun RemoteViews.color(context: Context, theme: String, id: Int, method: String, pick: (Palette) -> Int) {
    when {
      theme == "light" -> setInt(id, method, pick(LIGHT))
      theme == "dark" -> setInt(id, method, pick(DARK))
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> setColorInt(id, method, pick(LIGHT), pick(DARK))
      else -> setInt(id, method, pick(if (isNight(context)) DARK else LIGHT))
    }
  }

  private fun isNight(context: Context) =
    (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
}
