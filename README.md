<div align="center">

<img src="assets/images/icon.png" width="96" alt="Streakly icon" />

# Streakly

**A small, focused habit tracker for iOS and Android.**
Check off your habits, keep the streak alive, and see your progress at a glance.

![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)
![React Native 0.88](https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=black)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Reanimated 4](https://img.shields.io/badge/Reanimated-4-6B52AE)
![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Web-lightgrey)

</div>

---

## ✨ Features

- **Today at a glance**: one card per habit, with the habits due today listed first and rest days at the bottom. A progress card shows how much of the day is done.
- **Gestures**: long-press a card to drag it into a new order (the other cards make room as you move, with haptic ticks). Swipe right to delete, with a confirmation, or swipe left to edit.
- **Home-screen widget (Android)**: a list of today's habits that you can check off without opening the app.
- **Flexible schedules**: every day, or only on the weekdays you choose. Days off never break a streak.
- **Streaks & stats**: current streak, best streak and success rate for each habit.
- **Weekly chart**: animated bars with the completion rate of the last 8 weeks.
- **History calendar**: a month view of every day (done, not done, rest day). Tap a past day to fix it.
- **Reminders**: as many local notifications per habit as you want, picked with a custom snapping time wheel. They follow the habit's schedule.
- **Personal touch**: an emoji icon and an accent colour for each habit.
- **Confetti 🎉** when every habit due today is complete. It is skipped when the system "reduce motion" setting is on.
- **Settings**: light, dark or system theme, and a switch for all reminders.
- **Offline & private**: everything is stored on the device. No account, no backend, no tracking.

## 🧱 Tech stack

| Area           | Choice                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| Framework      | [Expo](https://expo.dev) SDK 58, React Native 0.88, React 19             |
| Language       | TypeScript, React Compiler enabled                                       |
| Navigation     | Expo Router (file-based routing, typed routes)                           |
| Animation      | React Native Reanimated 4 + Worklets, Gesture Handler                    |
| Storage        | `expo-sqlite` key-value store (falls back to `localStorage` on web)      |
| Notifications  | `expo-notifications`, weekly repeating local triggers                    |
| Widgets        | `react-native-android-widget` (rendered from JSX, runs headless)         |
| Builds         | EAS Build (development client, internal APK, production)                 |

No UI kit and no chart library: the cards, buttons, bar chart, calendar, time wheel and confetti are all built from scratch.

## 🔍 Under the hood

A few details worth a look:

- **Day states as a single source of truth.** Every day of a habit is one of `done`, `missed`, `pending`, `off`, `future` or `before`. Streaks, stats, charts and calendar colours are all derived from it ([`src/lib/habit-utils.ts`](src/lib/habit-utils.ts)).
- **Automatic back-filling.** When the app opens, and at midnight, each scheduled day that was not checked is recorded as "not done". The walk back is capped, so an app left unopened for months still starts instantly.
- **Cheap streaks.** The home screen streak walks back only as far as the streak goes, instead of replaying the whole history for every card.
- **Robust reminders.** One weekly notification per *scheduled day × reminder time*, all scheduled in parallel with `Promise.allSettled`. The habit is always saved, and the user is told if any reminder failed. A known Expo Go issue with Android notification channels is handled with a fallback to the default channel.
- **Stored data is untrusted.** Saved JSON is validated and repaired field by field when it loads. A copy of the original is kept before any repair, and if storage can't be read at all the app refuses to save, so a bad read can never wipe your habits.
- **Gestures on the UI thread.** Drag-to-reorder keeps the card order in a shared value and moves every card with Reanimated, so the list stays smooth while you drag. React state is updated only once, when you let go.
- **Widgets that work with the app closed.** A check on the widget runs in a background task that updates the saved data directly. While the app is open, the tap goes through the app's own state instead, so the two copies never overwrite each other.
- **Platform-specific modules.** `storage.web.ts`, `notifications.web.ts` and `use-color-scheme.web.ts` replace the native modules on web, with no runtime checks spread across the code.
- **Smooth custom transitions.** Pushed screens slide over the previous one, which stays mounted and visible underneath. Confetti runs entirely on the UI thread using only transforms and opacity.

## 📁 Project structure

```
src/
├── app/            # Expo Router screens: today, new habit, habit detail, edit, settings
├── components/     # Habit list and cards, charts, calendar, form, time wheel, dialogs, UI primitives
├── constants/      # Theme tokens (colours, spacing, radii, type), habit palette and icons
├── hooks/          # Theme and colour-scheme hooks
├── lib/            # Stores (React context), habit logic, validation, dates, storage, notifications
└── widgets/        # Android home-screen widgets and their background task
```

## 🚀 Getting started

**Requirements:** Node.js, and an Android device or emulator. The app uses native modules (widgets) that Expo Go doesn't include, so it runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/).

```bash
git clone https://github.com/TanturliMatteo/streakly.git
cd streakly
npm install

# once: build and install the development client (needs a free Expo account)
npx eas-cli@latest build --profile development --platform android

npx expo start
```

Open the installed Streakly app on the device and connect it to the dev server, or press `w` to run it in the browser.

To get a standalone APK that runs without a dev server: `npx eas-cli@latest build --profile preview --platform android`.

> Widgets are Android only. On web the app works fully, but without notifications.

### Useful scripts

```bash
npx expo lint        # lint
npx tsc --noEmit     # typecheck
npx expo-doctor      # check dependencies and config
```

## 👤 Author

**Matteo Tanturli** · [GitHub](https://github.com/TanturliMatteo) · [LinkedIn](https://www.linkedin.com/in/matteo-tanturli)

## 📄 License

[MIT](LICENSE)
