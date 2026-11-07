import { NewHabitScreen } from '@/components/habit-editor';
import { ScreenFrame } from '@/components/screen-frame';

export default function NewRoute() {
  return (
    <ScreenFrame>
      <NewHabitScreen />
    </ScreenFrame>
  );
}
