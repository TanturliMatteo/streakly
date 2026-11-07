import { useLocalSearchParams } from 'expo-router';

import { HabitDetailScreen } from '@/components/habit-detail';
import { ScreenFrame } from '@/components/screen-frame';

export default function HabitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScreenFrame>
      <HabitDetailScreen id={id} />
    </ScreenFrame>
  );
}
