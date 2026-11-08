import { StyleSheet } from 'react-native';

import { Alpha, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Motion } from './motion';
import { Card, PageScroll, Txt } from './ui';

/** Inline message card for problems the user should know about (in the app's card style). */
export function Notice({ icon, title, message }: { icon: string; title: string; message: string }) {
  const theme = useTheme();
  return (
    <Card entering={Motion.enter} style={[styles.card, { backgroundColor: withAlpha(theme.danger, Alpha.soft) }]}>
      <Txt variant="heading">
        {icon} {title}
      </Txt>
      <Txt variant="note" tone="textSecondary" style={styles.message}>
        {message}
      </Txt>
    </Card>
  );
}

/** Body of a habit page whose habit doesn't exist (deleted, or an old / mistyped link). */
export function HabitNotFound() {
  return (
    <PageScroll>
      <Notice
        icon="🔍"
        title="Habit not found"
        message="It may have been deleted. Go back to see your habits."
      />
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  message: { fontWeight: '400' },
});
