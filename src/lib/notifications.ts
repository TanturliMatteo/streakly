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

/** Runs a native call and labels any failure with the step it happened in. */
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`[${name}] ${message}`);
  }
}

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
    logEvent('error', `channel setup failed (using default channel): ${String(e)}`);
  }
}

/** Creates the Android channel and asks for permission. */
async function ensureNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await step('permission', () => Notifications.getPermissionsAsync());
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await step('permission', () => Notifications.requestPermissionsAsync());
  return requested.granted || requested.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

/**
 * Schedules one weekly repeating notification per (reminder day × time).
 * Never throws: on failure returns the ids scheduled so far plus an error message.
 */
export async function scheduleHabitReminders(habit: Habit): Promise<ScheduleResult> {
  if (!habit.reminder.enabled || habit.reminder.times.length === 0) return { ids: [] };

  const ids: string[] = [];
  try {
    if (!(await ensureNotificationPermission())) {
      return { ids, error: 'Notifications are turned off for this app. Enable them in Settings.' };
    }
    for (const day of habitDays(habit)) {
      for (const { hour, minute } of habit.reminder.times) {
        const id = await step('schedule', () =>
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
        );
        ids.push(id);
      }
    }
    logEvent(
      'action',
      `scheduled ${ids.length} reminder(s) for "${habit.name}" (channel: ${channelReady ? CHANNEL_ID : 'default'})`,
    );
    return { ids };
  } catch (e) {
    logEvent('error', `failed to schedule reminders after ${ids.length}: ${String(e)}`);
    return { ids, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelReminders(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}
