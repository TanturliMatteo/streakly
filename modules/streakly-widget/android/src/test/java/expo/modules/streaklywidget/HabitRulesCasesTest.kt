package expo.modules.streaklywidget

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Checks the widget's day rules (HabitRules) against the cases shared with the app
 * (src/lib/rules-cases.json; the app's TypeScript runs the same cases: `npm run test:rules`).
 */
class HabitRulesCasesTest {
  @Test
  fun widgetRulesMatchTheSharedCases() {
    val failures = checkRulesCases(File(findCasesFile()).readText())
    assertTrue("Rules differ from src/lib/rules-cases.json:\n" + failures.joinToString("\n"), failures.isEmpty())
  }

  /** The repository's cases file, found by walking up from the working directory. */
  private fun findCasesFile(): String {
    var dir: File? = File("").absoluteFile
    while (dir != null) {
      val candidate = File(dir, "src/lib/rules-cases.json")
      if (candidate.isFile) return candidate.path
      dir = dir.parentFile
    }
    error("src/lib/rules-cases.json not found above ${File("").absolutePath}")
  }
}

/** Runs every case; returns one line per mismatch (empty when all match). */
fun checkRulesCases(json: String): List<String> {
  val cases = JSONObject(json)
  val failures = ArrayList<String>()
  fun check(label: String, actual: Any, expected: Any) {
    if (actual != expected) failures.add("$label: expected $expected, got $actual")
  }

  cases.getJSONArray("dayState").forEachObject { c ->
    val actual = HabitRules.dayState(ruleHabit(c), logOf(c), c.getString("key"), c.getString("today"))
    check("dayState: ${c.getString("name")}", actual, c.getString("expected"))
  }
  cases.getJSONArray("isDue").forEachObject { c ->
    check("isDue: ${c.getString("state")}", HabitRules.isDue(c.getString("state")), c.getBoolean("expected"))
  }
  cases.getJSONArray("currentStreak").forEachObject { c ->
    val actual = HabitRules.currentStreak(ruleHabit(c), logOf(c), c.getString("today"))
    check("currentStreak: ${c.getString("name")}", actual, c.getInt("expected"))
  }
  cases.getJSONArray("streakSubtitle").forEachObject { c ->
    val actual = HabitRules.streakSubtitle(c.getString("description"), c.getInt("streak"))
    check("streakSubtitle: ${c.getInt("streak")} / \"${c.getString("description")}\"", actual, c.getString("expected"))
  }
  return failures
}

private fun ruleHabit(c: JSONObject): RuleHabit {
  val habit = c.getJSONObject("habit")
  val frequency = habit.getJSONObject("frequency")
  val days = frequency.optJSONArray("days")
  val weeklyDays = if (days == null) emptyList() else (0 until days.length()).map { days.getInt(it) }
  return HabitRules.habit(frequency.getString("type"), weeklyDays, habit.getString("createdAt"))
}

private fun logOf(c: JSONObject): Map<String, String> {
  val log = c.getJSONObject("log")
  return log.keys().asSequence().associateWith { log.getString(it) }
}

private inline fun JSONArray.forEachObject(action: (JSONObject) -> Unit) {
  for (i in 0 until length()) action(getJSONObject(i))
}
