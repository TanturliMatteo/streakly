import { useLocalSearchParams } from 'expo-router';

import { EditHabitScreen } from '@/components/habit-editor';
import { ScreenFrame } from '@/components/screen-frame';

export default function EditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScreenFrame>
      <EditHabitScreen id={id} />
    </ScreenFrame>
  );
}
