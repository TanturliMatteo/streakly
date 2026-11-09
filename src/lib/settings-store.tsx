/**
 * App settings (theme, reminders master switch), saved on the device.
 *
 * The saved theme is read synchronously and applied when this module loads, before the first
 * frame, so the app never flashes the system theme first.
 */
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { logEvent } from './debug-log';
import { loadItemSync, saveItem } from './storage';
import { SETTINGS_KEY } from './storage-keys';
import { DEFAULT_SETTINGS, parseSettings, type Settings, type ThemePreference } from './validate';

export type { Settings, ThemePreference };

/** Settings are only preferences: if they can't be read, the defaults are a safe fallback. */
function readSaved(): Settings {
  try {
    const raw = loadItemSync(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const { value, problems } = parseSettings(raw);
    problems.forEach((p) => logEvent('error', `loading settings: ${p}`));
    return value;
  } catch (e) {
    logEvent('error', `loading settings failed, using defaults: ${String(e)}`);
    return DEFAULT_SETTINGS;
  }
}

/** Overrides light / dark for the whole app (`useColorScheme`, native controls, system UI). */
function applyTheme(theme: ThemePreference) {
  // Optional call: react-native-web has no override, so on web the system theme is used.
  Appearance.setColorScheme?.(theme === 'system' ? 'auto' : theme);
}

const initial = readSaved();
applyTheme(initial.theme);

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(initial);

  function updateSettings(patch: Partial<Settings>) {
    logEvent('action', `settings ${JSON.stringify(patch)}`);
    // Applied right away (not in an effect), so the new theme lands in the same frame.
    if (patch.theme && patch.theme !== settings.theme) applyTheme(patch.theme);
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  // Persist every change (the loaded settings themselves don't need writing back).
  useEffect(() => {
    if (settings === initial) return;
    saveItem(SETTINGS_KEY, JSON.stringify(settings)).catch((e) =>
      logEvent('error', `saving settings failed: ${String(e)}`),
    );
  }, [settings]);

  return <SettingsContext value={{ settings, updateSettings }}>{children}</SettingsContext>;
}

export function useSettings() {
  const ctx = use(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
