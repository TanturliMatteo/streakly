import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

import { RoundButton, Txt } from './ui';

/** Header for pushed screens: round back button, centred title, optional right action. */
export function ScreenHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
      <RoundButton
        glyph="‹"
        glyphSize={28}
        accessibilityLabel="Back"
        logLabel={`back from "${title ?? 'screen'}"`}
        onPress={() => router.back()}
      />
      <Txt variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </Txt>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: { flex: 1, textAlign: 'center' },
  right: { minWidth: 40, alignItems: 'flex-end' },
});
