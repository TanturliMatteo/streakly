package expo.modules.streaklywidget

import android.content.Context
import android.graphics.Color
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale

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
  /** Weekdays as in JS `Date#getDay()`: 0 = Sunday … 6 = Saturday. */
  val days: Set<Int>,
  val createdAt: String,
)

/**
 * The widget's own copy of the app's data, so it works while the app is closed.
 *
 * - `data`: written by the app on every save (`{ theme, data: { habits, logs } }`, the same shape
 *   the app stores, already validated by it).
 * - `pending`: checks made in the widget (`[{ id, date, done }]`). They are shown at once and
 *   applied to the app's data the next time the app starts or comes to the foreground.
 *
 * "Today" is computed here with the same rules as `src/lib/habit-utils.ts` (`dayState`,
 * `currentStreak`, `streakSubtitle`), so a new day shows up without opening the app.
 * Keep the two in sync.
 */
object WidgetStore {
  private const val TAG = "StreaklyWidget"
  private const val PREFS = "streakly_widget"
  private const val KEY_DATA = "data"
  private const val KEY_PENDING = "pending"
  /** Longest streak walked back (10 years), a guard against bad dates. */
  private const val MAX_STREAK_DAYS = 3650
  private val FALLBACK_COLOR = Color.parseColor("#5B5BD6")
  private val ALL_DAYS = (0..6).toSet()

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
      pending.put(JSONObject().put("id", habitId).put("date", todayKey()).put("done", !row.done))
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

      val today = todayKey()
      val rows = habits.mapNotNull { h ->
        val log = effective[h.id] ?: mutableMapOf()
        val state = dayState(h, log, today, today)
        // Same as `isDue` in JS: rest days and days outside the habit's life are not shown.
        if (state != "done" && state != "pending" && state != "missed") return@mapNotNull null
        TodayRow(h.id, h.name, h.icon, h.color, state == "done", subtitle(h, currentStreak(h, log, today)))
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
      val days =
        if (frequency?.optString("type") == "weekly" && weekly != null) {
          (0 until weekly.length()).map { weekly.optInt(it, -1) }.filter { it in 0..6 }.toSet()
        } else {
          ALL_DAYS
        }
      val color =
        try {
          Color.parseColor(o.optString("color"))
        } catch (e: IllegalArgumentException) {
          FALLBACK_COLOR
        }
      habits.add(Habit(id, name, o.optString("description"), o.optString("icon"), color, days, o.optString("createdAt")))
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

  // ─── Day rules (mirror of src/lib/habit-utils.ts) ─────────────────────────

  private fun dayState(h: Habit, log: Map<String, String>, key: String, today: String): String {
    if (key < h.createdAt) return "before"
    if (key > today) return "future"
    log[key]?.let { return it }
    if (weekday(key) !in h.days) return "off"
    return if (key == today) "pending" else "missed"
  }

  private fun currentStreak(h: Habit, log: Map<String, String>, today: String): Int {
    var streak = 0
    val day = calendarOf(today)
    repeat(MAX_STREAK_DAYS) {
      when (dayState(h, log, keyOf(day), today)) {
        "done" -> streak++
        "missed", "before" -> return streak
        // "off" and "pending" (today, not done yet) don't break the streak.
      }
      day.add(Calendar.DAY_OF_MONTH, -1)
    }
    return streak
  }

  private fun subtitle(h: Habit, streak: Int): String =
    if (streak > 0) "🔥 $streak day streak" else h.description.ifEmpty { "Start your streak today" }

  // ─── Date keys (local time, `yyyy-MM-dd`, like `toKey` in JS) ──────────────

  fun todayKey(): String = keyOf(Calendar.getInstance())

  private fun keyOf(c: Calendar): String =
    String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))

  private fun calendarOf(key: String): Calendar {
    val parts = key.split("-")
    return Calendar.getInstance().apply {
      clear()
      set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
    }
  }

  /** 0 = Sunday … 6 = Saturday. */
  private fun weekday(key: String): Int = calendarOf(key).get(Calendar.DAY_OF_WEEK) - 1
}
