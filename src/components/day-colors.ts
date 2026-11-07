import { Alpha, type Theme, withAlpha } from '@/constants/theme';
import type { DayState } from '@/lib/types';

type DayColors = { fill: string; text: string; border: string };

/** One colour scheme for a day, shared by the home-card dots and the history calendar. */
export function dayColors(state: DayState, accent: string, theme: Theme): DayColors {
  switch (state) {
    case 'done':
      return { fill: accent, text: theme.onAccent, border: accent };
    case 'missed':
      return { fill: withAlpha(theme.danger, Alpha.medium), text: theme.danger, border: 'transparent' };
    case 'pending':
      return { fill: withAlpha(accent, Alpha.soft), text: theme.text, border: accent };
    case 'off':
      return { fill: theme.backgroundSelected, text: theme.textSecondary, border: 'transparent' };
    default: // 'before' creation / 'future'
      return { fill: 'transparent', text: theme.textMuted, border: 'transparent' };
  }
}
