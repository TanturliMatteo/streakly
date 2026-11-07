// Local scheduled notifications are only supported on iOS and Android.
import type { Habit, ScheduleResult } from './types';

export const notificationsSupported = false;

export async function scheduleHabitReminders(_habit: Habit): Promise<ScheduleResult> {
  return { ids: [] };
}

export async function cancelReminders(_ids: string[]) {}
