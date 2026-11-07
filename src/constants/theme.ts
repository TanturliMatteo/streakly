/**
 * Design tokens: every colour, size, radius, opacity and text style used by the app.
 * Components read from here instead of hard-coding values.
 */
import type { TextStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    textMuted: '#B9BBC6',
    tint: '#5B5BD6',
    danger: '#E5484D',
    /** Text / icons drawn on top of an accent colour. */
    onAccent: '#ffffff',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#1A1B1E',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    textMuted: '#5A5E66',
    tint: '#8B8DF8',
    danger: '#FF6369',
    onAccent: '#ffffff',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;
export type Theme = Record<ThemeColor, string>;

/** Accent colours a habit can use. */
export const HabitColors = [
  '#5B5BD6',
  '#3E9BF7',
  '#12A594',
  '#30A46C',
  '#F5A623',
  '#F76B15',
  '#E5484D',
  '#D6409F',
] as const;

/** A small set of simple icons (emoji) to pick from. */
// prettier-ignore
export const HabitIcons = [
  '💧', '🏃', '🧘', '📚', '💪', '🥗', '😴', '✍️',
  '🎸', '🧠', '🚭', '🦷', '💊', '🌱', '🚶', '☀️',
  '🧹', '💰', '📵', '🙏', '🎨', '🍎', '🚴', '❤️',
] as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  card: 28,
  /** Fully rounded ends; also makes square views into circles. */
  pill: 999,
} as const;

export const CardPadding = Spacing.three + 2;
export const MaxContentWidth = 800;

/** Opacity levels for tinted fills (`withAlpha(color, Alpha.soft)`). */
export const Alpha = {
  soft: 0.14,
  medium: 0.25,
  strong: 0.35,
} as const;

/** `#RRGGBB` + alpha (0–1) → `rgba()` */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Text styles. Use with `<Txt variant="…">` or spread into a StyleSheet. */
export const Type = {
  largeTitle: { fontSize: 34, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800' },
  stat: { fontSize: 26, fontWeight: '800', ...tabular },
  headline: { fontSize: 20, fontWeight: '800' },
  heading: { fontSize: 17, fontWeight: '700' },
  button: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '600' },
  bodyStrong: { fontSize: 15, fontWeight: '700', ...tabular },
  label: { fontSize: 14, fontWeight: '600' },
  overline: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  note: { fontSize: 13, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '600' },
  micro: { fontSize: 10, fontWeight: '600', ...tabular },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;
