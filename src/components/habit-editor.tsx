import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useHabit, useHabits } from '@/lib/habits-store';

import { HabitForm, showReminderError } from './habit-form';
import { Duration } from './motion';
import { ScreenHeader } from './screen-header';
import { PrimaryButton } from './ui';

/** Edit + habit pages slide out one after the other; remove the habit once both are gone. */
const AFTER_BOTH_SLIDES_MS = Duration.page * 2 + 100;

export function NewHabitScreen() {
  const { addHabit } = useHabits();
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <ScreenHeader title="New habit" />
      <HabitForm
        submitLabel="Create habit"
        onSubmit={async (input) => {
          const { reminderError } = await addHabit(input);
          router.back();
          if (reminderError) showReminderError(reminderError);
        }}
      />
    </KeyboardAvoidingView>
  );
}

export function EditHabitScreen({ id }: { id: string }) {
  const { habit, updateHabit, deleteHabit } = useHabit(id);
  const theme = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!habit) return <ScreenHeader title="Edit habit" />;

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <ScreenHeader title="Edit habit" />
      <HabitForm
        initial={habit}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          const { reminderError } = await updateHabit(habit.id, input);
          router.back();
          if (reminderError) showReminderError(reminderError);
        }}
        footer={
          // Two-tap delete: the first tap arms it, the second deletes.
          <PrimaryButton
            variant="soft"
            color={theme.danger}
            label={confirmDelete ? 'Tap again to delete forever' : 'Delete habit'}
            onPress={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              // Slide back home first, then remove the habit (its card fades out of the list).
              router.dismissTo('/');
              setTimeout(() => deleteHabit(habit.id), AFTER_BOTH_SLIDES_MS);
            }}
          />
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
