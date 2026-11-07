/** Weekday index as returned by `Date#getDay()`: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Frequency = { type: 'daily' } | { type: 'weekly'; days: Weekday[] };

export type ReminderTime = { hour: number; minute: number };

/** Reminders fire at each of `times` on the habit's scheduled days (they follow its frequency). */
export type ReminderSettings = {
  enabled: boolean;
  times: ReminderTime[];
};

export type Habit = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  frequency: Frequency;
  reminder: ReminderSettings;
  /** Local date key (YYYY-MM-DD) of the day the habit was created. */
  createdAt: string;
  /** Identifiers of the scheduled local notifications for this habit. */
  notificationIds: string[];
};

export type HabitInput = Omit<Habit, 'id' | 'createdAt' | 'notificationIds'>;

export type DayStatus = 'done' | 'missed';

/** date key (YYYY-MM-DD) → status */
export type HabitLog = Record<string, DayStatus>;

/** Result of scheduling a habit's reminders; `error` is set if it (partly) failed. */
export type ScheduleResult = { ids: string[]; error?: string };

/** Status of a single day as shown in the UI. */
export type DayState = DayStatus | 'pending' | 'off' | 'future' | 'before';
