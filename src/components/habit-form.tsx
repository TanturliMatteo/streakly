import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Common } from '@/constants/styles';
import { Alpha, CardPadding, HabitColors, HabitIcons, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeDays } from '@/lib/dates';
import { logEvent, logTap } from '@/lib/debug-log';
import { notificationsSupported } from '@/lib/notifications';
import type { Frequency, HabitInput, ReminderSettings, ReminderTime, Weekday } from '@/lib/types';

import { Collapsible } from './collapsible';
import { colorTransition, PressableScale } from './motion';
import { TimeWheel } from './time-wheel';
import {
  Card,
  IconBubble,
  PageScroll,
  PrimaryButton,
  SectionLabel,
  Segmented,
  Txt,
  WeekdayPicker,
} from './ui';

const MAX_TIMES = 3;
const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
const DEFAULT_TIME: ReminderTime = { hour: 9, minute: 0 };

const DEFAULT_HABIT: HabitInput = {
  name: '',
  description: '',
  icon: HabitIcons[0],
  color: HabitColors[0],
  frequency: { type: 'daily' },
  reminder: { enabled: false, times: [DEFAULT_TIME] },
};

/** The habit was saved, but its reminders couldn't be scheduled. */
export function showReminderError(message: string) {
  Alert.alert('Habit saved, but reminders failed', message);
}

/** Create / edit form shared by the "New habit" and "Edit habit" screens. */
export function HabitForm({
  initial = DEFAULT_HABIT,
  submitLabel,
  onSubmit,
  footer,
}: {
  initial?: HabitInput;
  submitLabel: string;
  onSubmit: (input: HabitInput) => Promise<void>;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color);
  // Frequency type and chosen days are kept apart, so the days survive switching to "Every day"
  // and back (and stay valid while the days picker collapses).
  const [frequencyType, setFrequencyType] = useState<Frequency['type']>(initial.frequency.type);
  const [weekDays, setWeekDays] = useState<Weekday[]>(
    initial.frequency.type === 'weekly' ? initial.frequency.days : WEEKDAYS,
  );
  const [reminder, setReminder] = useState<ReminderSettings>(initial.reminder);
  const [saving, setSaving] = useState(false);
  /** Index of the reminder time whose wheels are open, or null when all are collapsed. */
  const [openTime, setOpenTime] = useState<number | null>(null);

  const weekly = frequencyType === 'weekly';
  const frequency: Frequency = weekly ? { type: 'weekly', days: weekDays } : { type: 'daily' };
  const valid = name.trim().length > 0 && (!weekly || weekDays.length > 0);

  const updateReminder = (patch: Partial<ReminderSettings>) => setReminder((r) => ({ ...r, ...patch }));
  const setTimes = (times: ReminderTime[]) => updateReminder({ times });

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setOpenTime(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        icon,
        color,
        frequency,
        reminder,
      });
    } catch (e) {
      logEvent('error', `saving habit failed: ${String(e)}`);
      Alert.alert('Could not save habit', String(e));
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }];

  return (
    <PageScroll>
      <View style={styles.preview}>
        <IconBubble icon={icon} color={color} size={88} />
      </View>

      <Card>
        <SectionLabel>Name</SectionLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Drink water"
          placeholderTextColor={theme.textMuted}
          style={inputStyle}
          maxLength={40}
        />
        <SectionLabel>Short description</SectionLabel>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. 8 glasses a day"
          placeholderTextColor={theme.textMuted}
          style={[inputStyle, styles.lastInput]}
          maxLength={80}
        />
      </Card>

      <Card>
        <SectionLabel>Icon</SectionLabel>
        <View style={[styles.grid, styles.gridSpacing]}>
          {HabitIcons.map((i) => {
            const selected = i === icon;
            return (
              <PressableScale
                key={i}
                scaleTo={0.85}
                onPress={() => {
                  logTap(`icon ${i}`);
                  setIcon(i);
                }}
                style={[
                  Common.circle,
                  styles.iconCell,
                  colorTransition,
                  {
                    backgroundColor: selected ? withAlpha(color, Alpha.medium) : theme.backgroundSelected,
                    borderColor: selected ? color : 'transparent',
                  },
                ]}>
                <Text style={styles.iconText}>{i}</Text>
              </PressableScale>
            );
          })}
        </View>
        <SectionLabel>Color</SectionLabel>
        <View style={styles.grid}>
          {HabitColors.map((c) => (
            <PressableScale
              key={c}
              scaleTo={0.85}
              onPress={() => {
                logTap(`color ${c}`);
                setColor(c);
              }}
              accessibilityLabel={`Color ${c}`}
              style={[
                Common.circle,
                styles.colorRing,
                colorTransition,
                { borderColor: c === color ? c : 'transparent' },
              ]}>
              <View style={[styles.colorDot, { backgroundColor: c }]} />
            </PressableScale>
          ))}
        </View>
      </Card>

      <Card>
        <SectionLabel>Frequency</SectionLabel>
        <Segmented
          color={color}
          value={frequencyType}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekly', label: 'Specific days' },
          ]}
          onChange={setFrequencyType}
        />
        <Collapsible open={weekly}>
          <View style={styles.section}>
            <WeekdayPicker color={color} value={weekDays} onChange={setWeekDays} />
            <Txt variant="note" tone="textSecondary">
              {describeDays(weekDays)}
            </Txt>
          </View>
        </Collapsible>
      </Card>

      <Card>
        <View style={[Common.row, styles.switchRow]}>
          <View style={Common.flex}>
            <Txt variant="button">Reminders</Txt>
            <Txt variant="note" tone="textSecondary">
              {notificationsSupported
                ? 'Get a notification to keep you on track'
                : 'Notifications are only available on iOS and Android'}
            </Txt>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={(enabled) => {
              logTap(`reminders switch → ${enabled ? 'on' : 'off'}`);
              updateReminder({ enabled });
            }}
            trackColor={{ true: color }}
          />
        </View>

        <Collapsible open={reminder.enabled}>
          <View style={[styles.section, styles.sectionTop]}>
            <SectionLabel>Time</SectionLabel>
            {reminder.times.map((t, idx) => (
              <TimeWheel
                key={idx}
                color={color}
                value={t}
                expanded={openTime === idx}
                onExpandedChange={(open) => setOpenTime(open ? idx : null)}
                onChange={(nt) => setTimes(reminder.times.map((x, i) => (i === idx ? nt : x)))}
                onRemove={
                  reminder.times.length > 1
                    ? () => {
                        setOpenTime(null);
                        setTimes(reminder.times.filter((_, i) => i !== idx));
                      }
                    : undefined
                }
              />
            ))}
            {reminder.times.length < MAX_TIMES && (
              <PrimaryButton
                variant="soft"
                color={color}
                label="+ Add another time"
                onPress={() => {
                  const last = reminder.times[reminder.times.length - 1] ?? DEFAULT_TIME;
                  setTimes([...reminder.times, { hour: (last.hour + 3) % 24, minute: last.minute }]);
                  setOpenTime(reminder.times.length); // open the new one
                }}
              />
            )}
            <Txt variant="note" tone="textSecondary">
              Reminds you on your habit days · {describeDays(weekly ? weekDays : ALL_DAYS)}
            </Txt>
          </View>
        </Collapsible>
      </Card>

      <PrimaryButton
        label={saving ? 'Saving…' : submitLabel}
        color={color}
        disabled={!valid || saving}
        onPress={submit}
      />
      {footer}
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', paddingVertical: Spacing.two },
  section: { gap: Spacing.two, paddingTop: Spacing.two },
  sectionTop: { paddingTop: Spacing.three },
  input: {
    fontSize: 16,
    height: 48,
    borderRadius: Radius.pill,
    paddingHorizontal: CardPadding,
    marginBottom: Spacing.three,
  },
  lastInput: { marginBottom: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gridSpacing: { marginBottom: Spacing.three },
  iconCell: { width: 44, height: 44, borderWidth: 2 },
  iconText: { fontSize: 22 },
  colorRing: { width: 40, height: 40, borderWidth: 2 },
  colorDot: { width: 28, height: 28, borderRadius: Radius.pill },
  switchRow: { gap: Spacing.three },
});
