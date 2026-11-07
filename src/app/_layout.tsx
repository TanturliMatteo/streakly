import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useGlobalSearchParams,
  usePathname,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Celebration } from '@/components/confetti';
import { Colors } from '@/constants/theme';
import { installGlobalErrorLogging, logEvent } from '@/lib/debug-log';
import { HabitsProvider } from '@/lib/habits-store';

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
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <GestureHandlerRootView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <NavigationLogger />
        <HabitsProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="index" />
            {/* Pushed pages sit *over* the previous page (which stays loaded and visible) and do
                their own slide in/out — see ScreenFrame. Native animation and gestures are off. */}
            <Stack.Screen name="new" options={overlayPage} />
            <Stack.Screen name="habit/[id]" options={overlayPage} />
            <Stack.Screen name="edit/[id]" options={overlayPage} />
          </Stack>
          {/* Confetti on top of every screen when the day's habits are all done. */}
          <Celebration />
        </HabitsProvider>
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
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
