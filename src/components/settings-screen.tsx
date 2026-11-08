import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Common } from '@/constants/styles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logTap } from '@/lib/debug-log';
import { useHabits } from '@/lib/habits-store';
import { notificationsSupported } from '@/lib/notifications';
import { useSettings, type ThemePreference } from '@/lib/settings-store';

import { Collapsible } from './collapsible';
import { Duration, Ease, PressableScale } from './motion';
import { Screen } from './screen';
import { Card, PageScroll, SectionLabel, Segmented, Txt } from './ui';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const APP_NAME = Constants.expoConfig?.name ?? 'Streakly';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** Settings page (`/settings`): appearance, reminders, about. */
export function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateSettings } = useSettings();
  const { setRemindersEnabled } = useHabits();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function toggleReminders(enabled: boolean) {
    logTap(`all reminders switch → ${enabled ? 'on' : 'off'}`);
    setSwitching(true);
    try {
      const { reminderError } = await setRemindersEnabled(enabled);
      if (reminderError) Alert.alert('Some reminders could not be scheduled', reminderError);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Screen title="Settings">
      <PageScroll>
        <Card>
          <SectionLabel>Appearance</SectionLabel>
          <Segmented
            value={settings.theme}
            options={THEME_OPTIONS}
            onChange={(t) => updateSettings({ theme: t })}
          />
        </Card>

        <Card>
          <View style={[Common.row, styles.rowGap]}>
            <View style={Common.flex}>
              <Txt variant="button">Reminders</Txt>
              <Txt variant="note" tone="textSecondary">
                {notificationsSupported
                  ? settings.reminders
                    ? 'Habits with reminders will notify you'
                    : 'All reminders are paused'
                  : 'Notifications are only available on iOS and Android'}
              </Txt>
            </View>
            <Switch
              value={settings.reminders}
              disabled={switching || !notificationsSupported}
              onValueChange={toggleReminders}
              trackColor={{ true: theme.tint }}
            />
          </View>
          {notificationsSupported && (
            <>
              <Divider />
              <Row
                label="System notification settings"
                logLabel="open system notification settings"
                onPress={() => Linking.openSettings()}
              />
            </>
          )}
        </Card>

        <Card>
          <SectionLabel>About</SectionLabel>
          <View style={[Common.spread, styles.infoRow]}>
            <Txt>Version</Txt>
            <Txt tone="textSecondary">{APP_VERSION}</Txt>
          </View>
          <Divider />
          <Row
            label="Privacy"
            logLabel={`privacy → ${privacyOpen ? 'close' : 'open'}`}
            open={privacyOpen}
            onPress={() => setPrivacyOpen((o) => !o)}
          />
          <Collapsible open={privacyOpen}>
            <Txt variant="note" tone="textSecondary" style={styles.privacyText}>
              {APP_NAME} keeps your habits, history and reminders only on this device. Nothing is sent
              to a server, there are no accounts and no tracking. Uninstalling the app deletes your
              data.
            </Txt>
          </Collapsible>
        </Card>
      </PageScroll>
    </Screen>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />;
}

/** Tappable row with a chevron; `open` turns the chevron down (for rows that expand). */
function Row({
  label,
  logLabel,
  onPress,
  open,
}: {
  label: string;
  logLabel: string;
  onPress: () => void;
  open?: boolean;
}) {
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '90deg' : '0deg', { duration: Duration.base, easing: Ease }) }],
  }));
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityRole="button"
      onPress={() => {
        logTap(logLabel);
        onPress();
      }}
      style={[Common.row, styles.infoRow]}>
      <Txt style={Common.flex}>{label}</Txt>
      <Animated.View style={chevronStyle}>
        <Txt tone="textSecondary" style={styles.chevron}>
          ›
        </Txt>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  rowGap: { gap: Spacing.three },
  infoRow: { paddingVertical: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  chevron: { fontSize: 22, lineHeight: 24 },
  privacyText: { paddingTop: Spacing.one, paddingBottom: Spacing.two, fontWeight: '400' },
});
