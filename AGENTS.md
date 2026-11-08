This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Engineering standards (apply to every change)

Streakly is a local-only app (no backend yet) used daily; treat it as production code.
Priority: preserve working behaviour > security & privacy > reliability > maintainability > performance.

**Before changing**
- Read the code paths involved first; don't guess intended behaviour. Product/UX choices
  (layouts, gestures, widget design, wording) are the user's: ask, with a recommendation.
- Prefer small, targeted, reversible edits that follow existing patterns: tokens in
  `src/constants/theme.ts` + `src/components/motion.tsx`, the `<Screen>` shell for pushed pages,
  shared UI from `src/components/ui.tsx`, logic in `src/lib/`. No rewrites for style, no new
  dependency when the platform or an existing module covers it.

**Data & state**
- Persisted keys (`habits-app/v1`, `habits-app/settings/v1`) are a contract: changing their shape
  needs a migration that keeps old data loading, and the user's approval.
- Treat stored JSON and route / deep-link params (`habitsapp://`, `/habit/[id]`) as untrusted:
  validate, fall back safely, never crash or wipe data on bad input.
- State updates that depend on previous state use the functional form. Shared values written from
  JS must not be read-modify-written from JS (merge on the UI thread with `.modify`).

**Errors**
- No silent failures: every `catch` logs with `logEvent('error', …)` and either recovers or tells
  the user in the app's own style. No empty catches, no unhandled promises.
- Failures of side effects (notifications, storage) must not lose the user's data; report partial
  failures (as `SaveResult.reminderError` does).

**Security & privacy**
- No secrets or keys in the repo, `app.json`, `eas.json` or the JS bundle. Logs stay `__DEV__`-only
  and never contain personal content beyond what debugging needs.
- Ask only for permissions that are used, and handle "denied" gracefully.
- For the planned login / cloud sync: auth on the server side, row-level security, local data stays
  the source of truth offline.

**UI & performance**
- Smoothness is a requirement: animate transform / opacity on the UI thread, use the `Duration` /
  `Ease` tokens, no springs or bounce unless asked, check both open and close directions.
- Avoid per-frame O(n²) work and unnecessary re-renders; optimise only with a concrete reason.
- Log new interactions with `logTap` / `logEvent` so bugs can be traced from the Metro log.

**Done means**
- `npx tsc --noEmit` and `npx expo lint` pass (run them, never assume). Run `npx expo-doctor`
  after dependency or config changes.
- Say what was verified and what wasn't (e.g. "not yet tested on device"); call out anything that
  needs a new native build. Remove temporary debug code before finishing.
- No automated tests yet: when touching pure logic in `src/lib/` (dates, streaks, backfill,
  reorder), propose adding tests rather than adding a framework silently.

A full audit procedure (architecture, security, reliability, performance, code quality, then
approved fixes) lives in `.claude/skills/audit/SKILL.md`; run it with `/audit`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
