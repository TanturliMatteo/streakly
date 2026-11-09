/**
 * Checks the app's day rules (src/lib/habit-utils.ts) against the cases shared with the widget
 * (src/lib/rules-cases.json; the widget's Kotlin copy runs the same cases in HabitRulesCasesTest).
 *
 * Run: npm run test:rules   (Node 24+: runs the TypeScript sources directly, no build step)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// The app's sources import without extensions ('./dates'), as Metro allows: try `.ts` too.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') || /\.[cm]?[jt]sx?$/.test(specifier)) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const { currentStreak, dayState, isDue, streakSubtitle } = await import('../src/lib/habit-utils.ts');
const cases = JSON.parse(readFileSync(new URL('../src/lib/rules-cases.json', import.meta.url), 'utf8'));

/** A full habit from a case's `{ frequency, createdAt }`. */
const habitOf = (h, description = '') => ({
  id: 'case',
  name: 'Case',
  description,
  icon: '✅',
  color: '#5B5BD6',
  reminder: { enabled: false, times: [] },
  notificationIds: [],
  ...h,
});

for (const c of cases.dayState) {
  test(`dayState: ${c.name}`, () => {
    assert.equal(dayState(habitOf(c.habit), c.log, c.key, c.today), c.expected);
  });
}

for (const c of cases.isDue) {
  test(`isDue: ${c.state}`, () => {
    assert.equal(isDue(c.state), c.expected);
  });
}

for (const c of cases.currentStreak) {
  test(`currentStreak: ${c.name}`, () => {
    assert.equal(currentStreak(habitOf(c.habit), c.log, c.today), c.expected);
  });
}

for (const c of cases.streakSubtitle) {
  test(`streakSubtitle: ${c.streak} / "${c.description}"`, () => {
    assert.equal(streakSubtitle(habitOf({}, c.description), c.streak), c.expected);
  });
}
