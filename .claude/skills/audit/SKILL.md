---
name: audit
description: Full technical audit of the Streakly codebase (architecture, security, reliability, performance, code quality, dependencies), then a controlled, approved remediation. Run only when the user invokes /audit.
disable-model-invocation: true
---

# Audit: production-grade review of Streakly

Act as a principal engineer and application-security engineer. Audit the whole codebase, report
findings, and improve it **without breaking behaviour or changing intended product logic**.
This is a controlled improvement process, not a rewrite. Write the report in Italian (the
user's language); keep code, identifiers and commit messages in English.

## 0. Ground rules

- Understand before changing: read the code paths involved; never guess intended behaviour.
- **No code changes until the findings are presented and the user approves the plan.**
- Small, isolated, reversible changes; one concern per change; keep existing conventions
  (tokens in `src/constants/theme.ts` + `src/components/motion.tsx`, the `<Screen>` shell,
  `logTap` / `logEvent` breadcrumbs, routes only in `src/app/`).
- Never: rewrite files for style, remove working features, add dependencies without need,
  swallow errors silently, weaken checks to make them pass, upgrade major versions without approval.
- Persisted data is a contract: `habits-app/v1` and `habits-app/settings/v1` (expo-sqlite
  kv-store / `localStorage` on web). Any shape change needs a migration and approval.
- Expo APIs change every SDK: verify against the versioned docs (see `AGENTS.md`) before
  touching an Expo / React Native API. Native changes need a new dev build — flag them.
- Never report something as passing unless the command was actually run.

## 1. Baseline (run before anything else, record results)

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
npm audit --omit=dev
npx expo export --platform android   # production JS bundle builds
npx expo export --platform web
```

There is no automated test suite yet: say so in the report and propose where tests would pay off
(pure logic in `src/lib/` — dates, streaks, backfill, reorder — is the obvious first target).

## 2. Reconnaissance

Produce a short architectural overview: entry (`src/app/_layout.tsx`), routes, providers
(`SettingsProvider` → `HabitsProvider`), state and persistence, notifications, animation /
gesture layer, web vs native splits (`*.web.ts`), config (`app.json`, `eas.json`, plugins).
Flag coupling, duplication, dead code (e.g. leftovers from the Expo template), hidden
assumptions and single points of failure.

## 3. Security & privacy (scaled to a local-only app)

Severity scale: CRITICAL / HIGH / MEDIUM / LOW / INFO. For each finding: component, weakness,
impact, exploit path (if any), fix, and whether the fix is breaking.

Check in particular:
- Untrusted input: parsing of persisted JSON (corrupt / old-shape data must not crash or
  wipe data), deep links via the `habitsapp://` scheme and route params (`/habit/[id]`, `/edit/[id]`).
- Data protection: secrets or keys in the repo, `app.json`, `eas.json`; sensitive data in logs
  (the dev logger must stay `__DEV__`-only); Android backup / data exposure settings.
- Permissions: only what is needed (notifications); behaviour when denied.
- Web target (`web.output: "server"`): anything exposed by the server output, security headers if deployed.
- Dependencies: `npm audit` results, deprecated / unused packages (template leftovers).
- Future work note: login and cloud sync (Supabase / Firebase) are planned — list what must be
  designed in (auth, row-level security, no keys in the bundle) but do not implement it.

Do not declare the app "secure" just because nothing obvious was found.

## 4. Reliability & error handling

- Unhandled promise rejections, empty / swallowing `catch`, `console.warn`-only failures that
  should reach the user.
- Persistence: failed load or save, race between load and first save, writes during app
  background / kill, concurrent `setData` updates, midnight / timezone / DST rollover.
- Notifications: permission denied, scheduling partial failures, ids getting out of sync
  with the OS after reinstall or the master switch.
- UI-thread code (worklets, gestures, layout measurement): stale reads of shared values from
  JS, state that can get stuck (e.g. a card left invisible or mid-swipe).
- Missing error boundary for render crashes (expo-router `ErrorBoundary` export).

## 5. Performance

Only with a technical justification. Look at: re-renders of the home list and context consumers,
O(n²) work on the UI thread per frame, heavy work during animations, JSON (de)serialisation of the
whole store on every change, bundle size, image / font assets. Animation smoothness is a product
requirement: prefer transform / opacity, shared `Duration` tokens, no springs where the user asked
for none.

## 6. Code quality

Type safety (`as` casts, unchecked JSON), null handling, oversized modules, duplicated logic,
naming, consistency with the existing patterns. No abstraction for its own sake.

## 7. Plan → approval → implementation

1. Present findings ranked by risk and impact; mark quick wins vs risky changes and anything
   that needs a native rebuild or a data migration.
2. **Stop and wait for the user's approval** (they decide UX-visible changes).
3. Implement approved items one at a time; after each: `npx tsc --noEmit` and `npx expo lint`;
   at the end rerun the full baseline and compare.
4. Ask the user to verify on the Android dev build anything gesture / animation / notification
   related, with the `[habits …]` log lines to watch.

## 8. Final report (Italian)

A. Sintesi · B. Sicurezza (finding, severità, stato) · C. Affidabilità · D. Prestazioni ·
E. Qualità del codice · F. Modifiche fatte (file + motivo) · G. Verifiche eseguite vs baseline ·
H. Problemi aperti e rischi accettati · I. Prontezza per il rilascio, basata su prove.

Priority order: preserve functionality > security > reliability > maintainability > performance.
Identify before changing, verify before and after, never hide a failure.
