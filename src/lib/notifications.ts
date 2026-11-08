import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { logEvent } from './debug-log';
import { habitDays } from './habit-utils';
import type { Habit, ScheduleResult } from './types';

const CHANNEL_ID = 'habit-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationsSupported = true;

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Whether our own Android channel is known to exist; otherwise expo's default channel is used. */
let channelReady = false;

/**
 * Creates the Android channel (needed before the Android 13+ permission prompt).
 *
 * Expo Go on Android can throw `NullPointerException ... Object.getClass()` here. The channel
 * is created, but converting the result (which has null fields like `sound`/`groupId`) back to
 * JS fails. So a failure is logged and ignored: reminders then fall back to expo's default channel.
 */
async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Habit reminders',
      importance: AndroidImportance.HIGH,
    });
    channelReady = true;
  } catch (e) {
    logEvent('error', `channel setup failed (using default channel): ${errorText(e)}`);
  }
}

/** Creates the Android channel, then asks for permission if needed. Throws `[permission] …`. */
async function ensurePermission(): Promise<boolean> {
  await ensureChannel();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted || requested.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  } catch (e) {
    throw new Error(`[permission] ${errorText(e)}`);
  }
}

/**
 * Schedules one weekly repeating notification per (habit day × reminder time), all in parallel.
 * Never throws: returns the ids that were scheduled, plus an error message if any failed.
 */
export async function scheduleHabitReminders(habit: Habit): Promise<ScheduleResult> {
  const { enabled, times } = habit.reminder;
  if (!enabled || times.length === 0) return { ids: [] };

  try {
    if (!(await ensurePermission())) {
      return { ids: [], error: 'Notifications are turned off for this app. Enable them in Settings.' };
    }
  } catch (e) {
    logEvent('error', `reminder permission failed: ${errorText(e)}`);
    return { ids: [], error: errorText(e) };
  }

  const results = await Promise.allSettled(
    habitDays(habit).flatMap((day) =>
      times.map(({ hour, minute }) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: `${habit.icon}  ${habit.name}`,
            body: habit.description || 'Time for your habit. Keep the streak going!',
            data: { habitId: habit.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day + 1, // expo: 1 = Sunday … 7 = Saturday
            hour,
            minute,
            ...(channelReady ? { channelId: CHANNEL_ID } : null),
          },
        }),
      ),
    ),
  );

  const ids = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failure = results.find((r) => r.status === 'rejected');
  if (failure) {
    const error = `[schedule] ${errorText(failure.reason)}`;
    logEvent('error', `scheduled ${ids.length}/${results.length} reminders for "${habit.name}": ${error}`);
    return { ids, error };
  }
  const channel = channelReady ? CHANNEL_ID : 'default';
  logEvent('action', `scheduled ${ids.length} reminder(s) for "${habit.name}" (channel: ${channel})`);
  return { ids };
}

export async function cancelReminders(ids: string[]) {
  // A failed cancel (e.g. an id the OS no longer knows after a reinstall) must not block the
  // others or the save, but it is logged.
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch((e) =>
        logEvent('error', `cancelling reminder ${id} failed: ${errorText(e)}`),
      ),
    ),
  );
}
