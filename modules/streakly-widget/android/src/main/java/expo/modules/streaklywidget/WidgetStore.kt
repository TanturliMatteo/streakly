package expo.modules.streaklywidget

import android.content.Context
import android.graphics.Color
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/** One habit due today, ready to draw. */
data class TodayRow(
  val id: String,
  val name: String,
  val icon: String,
  val color: Int,
  val done: Boolean,
  val subtitle: String,
)

/** What the widget shows. `theme` is the app's setting: "system", "light" or "dark". */
data class TodayState(val theme: String, val hasHabits: Boolean, val rows: List<TodayRow>) {
  val doneCount: Int get() = rows.count { it.done }
}

private class Habit(
  val id: String,
  val name: String,
  val description: String,
  val icon: String,
  val color: Int,
  val rule: RuleHabit,
)

/**
 * The widget's own copy of the app's data, so it works while the app is closed.
 *
 * - `data`: written by the app on every save (`{ theme, data: { habits, logs } }`, the same shape
 *   the app stores, already validated by it).
 * - `pending`: checks made in the widget (`[{ id, date, done }]`). They are shown at once and
 *   applied to the app's data the next time the app starts or comes to the foreground.
 *
 * "Today" is computed here with `HabitRules` (the app's rules, checked against the same cases),
 * so a new day shows up without opening the app.
 */
object WidgetStore {
  private const val TAG = "StreaklyWidget"
  private const val PREFS = "streakly_widget"
  private const val KEY_DATA = "data"
  private const val KEY_PENDING = "pending"
  private val FALLBACK_COLOR = Color.parseColor("#5B5BD6")

  private val lock = Any()

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setData(context: Context, json: String) {
    synchronized(lock) { prefs(context).edit().putString(KEY_DATA, json).commit() }
  }

  /** Returns the widget checks the app hasn't applied yet (JSON array) and clears them. */
  fun takePending(context: Context): String = synchronized(lock) {
    val p = prefs(context)
    val pending = p.getString(KEY_PENDING, null) ?: "[]"
    p.edit().remove(KEY_PENDING).commit()
    pending
  }

  /** Flips today's check for a habit (done ↔ not done). */
  fun toggleToday(context: Context, habitId: String) {
    synchronized(lock) {
      val row = readToday(context)?.rows?.firstOrNull { it.id == habitId } ?: return
      val p = prefs(context)
      val pending = parseArray(p.getString(KEY_PENDING, null))
      pending.put(JSONObject().put("id", habitId).put("date", HabitRules.todayKey()).put("done", !row.done))
      p.edit().putString(KEY_PENDING, pending.toString()).commit()
    }
  }

  /** Today's due habits with pending widget checks applied; null if the saved data is unreadable. */
  fun readToday(context: Context): TodayState? = synchronized(lock) {
    val p = prefs(context)
    val raw = p.getString(KEY_DATA, null) ?: return@synchronized TodayState("system", false, emptyList())
    try {
      val root = JSONObject(raw)
      val data = root.getJSONObject("data")
      val habits = parseHabits(data.optJSONArray("habits") ?: JSONArray())
      val logs = data.optJSONObject("logs") ?: JSONObject()
      val effective = HashMap<String, MutableMap<String, String>>()
      for (h in habits) effective[h.id] = toLog(logs.optJSONObject(h.id))
      applyPending(effective, parseArray(p.getString(KEY_PENDING, null)))

      val today = HabitRules.todayKey()
      val rows = habits.mapNotNull { h ->
        val log = effective[h.id] ?: mutableMapOf()
        val state = HabitRules.dayState(h.rule, log, today, today)
        if (!HabitRules.isDue(state)) return@mapNotNull null
        val streak = HabitRules.currentStreak(h.rule, log, today)
        TodayRow(h.id, h.name, h.icon, h.color, state == "done", HabitRules.streakSubtitle(h.description, streak))
      }
      TodayState(root.optString("theme", "system"), habits.isNotEmpty(), rows)
    } catch (e: Exception) {
      Log.w(TAG, "reading widget data failed", e)
      null
    }
  }

  // ─── Parsing ───────────────────────────────────────────────────────────────

  private fun parseArray(raw: String?): JSONArray =
    try {
      if (raw == null) JSONArray() else JSONArray(raw)
    } catch (e: Exception) {
      Log.w(TAG, "pending widget checks unreadable, dropped", e)
      JSONArray()
    }

  private fun parseHabits(arr: JSONArray): List<Habit> {
    val habits = ArrayList<Habit>()
    for (i in 0 until arr.length()) {
      val o = arr.optJSONObject(i) ?: continue
      val id = o.optString("id")
      val name = o.optString("name")
      if (id.isEmpty() || name.isEmpty()) continue
      val frequency = o.optJSONObject("frequency")
      val weekly = frequency?.optJSONArray("days")
      val weeklyDays = if (weekly == null) emptyList() else (0 until weekly.length()).map { weekly.optInt(it, -1) }
      val rule = HabitRules.habit(frequency?.optString("type") ?: "daily", weeklyDays, o.optString("createdAt"))
      val color =
        try {
          Color.parseColor(o.optString("color"))
        } catch (e: IllegalArgumentException) {
          FALLBACK_COLOR
        }
      habits.add(Habit(id, name, o.optString("description"), o.optString("icon"), color, rule))
    }
    return habits
  }

  private fun toLog(o: JSONObject?): MutableMap<String, String> {
    val log = HashMap<String, String>()
    if (o == null) return log
    val keys = o.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      val status = o.optString(key)
      if (status == "done" || status == "missed") log[key] = status
    }
    return log
  }

  private fun applyPending(logs: Map<String, MutableMap<String, String>>, pending: JSONArray) {
    for (i in 0 until pending.length()) {
      val change = pending.optJSONObject(i) ?: continue
      val log = logs[change.optString("id")] ?: continue
      val date = change.optString("date")
      if (date.isEmpty()) continue
      if (change.optBoolean("done")) log[date] = "done" else log.remove(date)
    }
  }
}
