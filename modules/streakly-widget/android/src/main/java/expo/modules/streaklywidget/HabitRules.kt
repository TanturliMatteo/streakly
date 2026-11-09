package expo.modules.streaklywidget

import java.util.Calendar
import java.util.Locale

/** The part of a habit the day rules need. `days`: 0 = Sunday … 6 = Saturday (like JS `getDay()`). */
class RuleHabit(val createdAt: String, val days: Set<Int>)

/**
 * Day rules of the widget: a mirror of `src/lib/habit-utils.ts` (`dayState`, `isDue`,
 * `currentStreak`, `streakSubtitle`). The TypeScript version is the reference.
 *
 * Both are checked against the same cases, `src/lib/rules-cases.json`:
 * `npm run test:rules` (TypeScript) and `HabitRulesCasesTest` (this file). Change a rule in both
 * places and add a case for it.
 *
 * Pure Kotlin (no Android classes), so it can be tested on the JVM.
 */
object HabitRules {
  /** Longest streak walked back (10 years), a guard against bad dates. */
  private const val MAX_STREAK_DAYS = 3650
  private val ALL_DAYS = (0..6).toSet()

  /**
   * Builds the rule view of a habit from its stored frequency (`daily`, or `weekly` + days).
   * Weekly without a valid day counts as every day, like `parseFrequency` in src/lib/validate.ts.
   */
  fun habit(frequencyType: String, weeklyDays: List<Int>, createdAt: String): RuleHabit {
    val weekly = weeklyDays.filter { it in 0..6 }.toSet()
    return RuleHabit(createdAt, if (frequencyType == "weekly" && weekly.isNotEmpty()) weekly else ALL_DAYS)
  }

  /** "done", "missed", "pending", "off", "future" or "before". */
  fun dayState(h: RuleHabit, log: Map<String, String>, key: String, today: String): String {
    if (key < h.createdAt) return "before"
    if (key > today) return "future"
    log[key]?.let { return it }
    if (weekday(key) !in h.days) return "off"
    return if (key == today) "pending" else "missed"
  }

  /** Counts towards the day's progress (not a rest day, not outside the habit's life). */
  fun isDue(state: String): Boolean = state == "done" || state == "pending" || state == "missed"

  /** Consecutive done days ending today (or yesterday, if today isn't checked yet). */
  fun currentStreak(h: RuleHabit, log: Map<String, String>, today: String): Int {
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

  fun streakSubtitle(description: String, streak: Int): String =
    if (streak > 0) "🔥 $streak day streak" else description.ifEmpty { "Start your streak today" }

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

  private fun weekday(key: String): Int = calendarOf(key).get(Calendar.DAY_OF_WEEK) - 1
}
