/**
 * In-app confirmation dialog (instead of the system alert), in the app's card style.
 * Controlled by `open`: it fades / scales in, and on close fades out before unmounting, so the
 * caller can act right away (e.g. delete a habit while the dialog is leaving).
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Common } from '@/constants/styles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logTap } from '@/lib/debug-log';

import { Duration, Ease } from './motion';
import { Card, IconBubble, PrimaryButton, Txt } from './ui';

const TIMING = { duration: Duration.fast, easing: Ease };

export function ConfirmDialog({
  open,
  icon,
  color,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  icon?: string;
  /** Accent of the confirm button and icon (e.g. `theme.danger`). */
  color: string;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  // Stay mounted until the closing fade has finished.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!mounted) return;
    progress.set(
      withTiming(open ? 1 : 0, TIMING, (finished) => {
        if (finished && !open) scheduleOnRN(setMounted, false);
      }),
    );
  }, [open, mounted, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.94 + 0.06 * progress.get() }],
  }));

  const cancel = () => {
    if (!open) return;
    logTap(`dialog "${title}" → cancel`);
    onCancel();
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}>
      <View style={[Common.flex, Common.center, styles.root]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable accessibilityLabel="Cancel" style={Common.flex} onPress={cancel} />
        </Animated.View>
        <Card style={[styles.card, cardStyle]}>
          {icon && <IconBubble icon={icon} color={color} size={64} />}
          <Txt variant="headline" style={Common.textCenter}>
            {title}
          </Txt>
          <Txt variant="note" tone="textSecondary" style={[Common.textCenter, styles.message]}>
            {message}
          </Txt>
          <View style={styles.buttons}>
            <PrimaryButton
              label={confirmLabel}
              color={color}
              onPress={() => {
                if (open) onConfirm();
              }}
            />
            <PrimaryButton variant="soft" color={theme.textSecondary} label="Cancel" onPress={cancel} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { padding: Spacing.four },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  message: { fontWeight: '400', marginBottom: Spacing.two },
  buttons: { alignSelf: 'stretch', gap: Spacing.two },
});
