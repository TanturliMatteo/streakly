import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useGlobalSearchParams,
  usePathname,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Celebration } from '@/components/confetti';
import { Notice } from '@/components/notice';
import { PageScroll, PrimaryButton } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { installGlobalErrorLogging, logEvent } from '@/lib/debug-log';
import { HabitsProvider } from '@/lib/habits-store';
import { SettingsProvider } from '@/lib/settings-store';

// Pages opened from a link (e.g. a habit tapped in the widget) keep Home underneath, so back works.
export const unstable_settings = { initialRouteName: 'index' };

SplashScreen.preventAutoHideAsync();
installGlobalErrorLogging();

/** Logs every screen change to the Metro terminal (dev only). */
function NavigationLogger() {
  const pathname = usePathname();
  const paramText = JSON.stringify(useGlobalSearchParams());
  useEffect(() => {
    logEvent('nav', `${pathname} ${paramText}`);
  }, [pathname, paramText]);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // The window behind the screens matches the theme, so nothing light flashes through.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch((e) =>
      logEvent('error', `setting window background failed: ${String(e)}`),
    );
  }, [colors.background]);

  return (
    <GestureHandlerRootView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <NavigationLogger />
        <SettingsProvider>
          <HabitsProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="index" />
              {/* Pushed pages sit *over* the previous page (which stays loaded and visible) and do
                  their own slide in/out — see <Screen>. Native animation and gestures are off. */}
              <Stack.Screen name="new" options={overlayPage} />
              <Stack.Screen name="habit/[id]" options={overlayPage} />
              <Stack.Screen name="edit/[id]" options={overlayPage} />
              <Stack.Screen name="settings" options={overlayPage} />
            </Stack>
            {/* Confetti on top of every screen when the day's habits are all done. */}
            <Celebration />
          </HabitsProvider>
        </SettingsProvider>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** Shown by Expo Router instead of a red screen / white page when rendering crashes. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  useEffect(() => {
    logEvent('error', `render crash: ${error.message}`);
  }, [error]);
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
      <PageScroll>
        <Notice
          icon="😵"
          title="Something went wrong"
          message="Your habits are safe on this device. Try again, or restart the app if this keeps happening."
        />
        <PrimaryButton label="Try again" onPress={() => void retry()} />
      </PageScroll>
    </SafeAreaView>
  );
}

const overlayPage = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
} as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
