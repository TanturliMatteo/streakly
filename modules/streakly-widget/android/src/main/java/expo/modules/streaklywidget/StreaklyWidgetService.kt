package expo.modules.streaklywidget

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/** Rows of the widget's list on Android 11 and older (12+ passes the rows directly, see WidgetViews). */
class StreaklyWidgetService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = Factory(applicationContext)

  private class Factory(private val context: Context) : RemoteViewsFactory {
    private var state: TodayState? = null

    override fun onCreate() {}

    override fun onDataSetChanged() {
      state = WidgetStore.readToday(context)
    }

    override fun onDestroy() {}

    override fun getCount(): Int = state?.rows?.size ?: 0

    override fun getViewAt(position: Int): RemoteViews {
      val current = state
      val row = current?.rows?.getOrNull(position)
        ?: return RemoteViews(context.packageName, R.layout.streakly_widget_row)
      return WidgetViews.row(context, current.theme, row)
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long =
      state?.rows?.getOrNull(position)?.id?.hashCode()?.toLong() ?: position.toLong()

    override fun hasStableIds(): Boolean = true
  }
}
