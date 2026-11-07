/** Shared building blocks. Screens compose these instead of styling raw views. */
import { useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps, type TextProps } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import {
  Alpha,
  CardPadding,
  MaxContentWidth,
  Radius,
  Spacing,
  Type,
  withAlpha,
  type ThemeColor,
  type TypeVariant,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WEEK_ORDER, WEEKDAY_LETTER } from '@/lib/dates';
import { logTap } from '@/lib/debug-log';
import type { Weekday } from '@/lib/types';

import { colorTransition, Duration, PressableScale, transition } from './motion';

/** Themed text: a type style + a theme colour (or an explicit `color`). */
export function Txt({
  variant = 'body',
  tone = 'text',
  color,
  style,
  ...rest
}: TextProps & { variant?: TypeVariant; tone?: ThemeColor; color?: string }) {
  const theme = useTheme();
  return <Text style={[Type[variant], { color: color ?? theme[tone] }, style]} {...rest} />;
}

/** Vertical page with the standard padding / spacing / max width. */
export function PageScroll({ children, ...rest }: ScrollViewProps) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" {...rest} contentContainerStyle={styles.page}>
      {children}
    </ScrollView>
  );
}

/** Rounded surface used everywhere. */
export function Card({ style, ...rest }: ComponentProps<typeof Animated.View>) {
  const theme = useTheme();
  return (
    <Animated.View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]} {...rest} />
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Txt variant="overline" tone="textSecondary" style={styles.sectionLabel}>
      {children}
    </Txt>
  );
}

export function IconBubble({ icon, color, size = 48 }: { icon: string; color: string; size?: number }) {
  return (
    <Animated.View
      style={[
        styles.bubble,
        { width: size, height: size, backgroundColor: withAlpha(color, Alpha.soft) },
        colorTransition,
      ]}>
      {/* key: a new icon pops in */}
      <Animated.Text key={icon} entering={ZoomIn.duration(Duration.fast)} style={{ fontSize: size * 0.48 }}>
        {icon}
      </Animated.Text>
    </Animated.View>
  );
}

/** Circular icon button (back, calendar arrows, remove). */
export function RoundButton({
  glyph,
  onPress,
  logLabel,
  accessibilityLabel,
  size = 40,
  glyphSize = Math.round(size * 0.65),
  tone = 'text',
  background = 'backgroundElement',
  disabled,
}: {
  glyph: string;
  onPress: () => void;
  logLabel: string;
  accessibilityLabel?: string;
  size?: number;
  glyphSize?: number;
  tone?: ThemeColor;
  background?: ThemeColor | 'none';
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={() => {
        logTap(logLabel);
        onPress();
      }}
      disabled={disabled}
      hitSlop={8}
      scaleTo={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.round,
        {
          width: size,
          height: size,
          backgroundColor: background === 'none' ? 'transparent' : theme[background],
          opacity: disabled ? 0.3 : 1,
        },
      ]}>
      <Text style={{ color: theme[tone], fontSize: glyphSize, lineHeight: glyphSize + 2, fontWeight: '600' }}>
        {glyph}
      </Text>
    </PressableScale>
  );
}

export function CheckButton({
  done,
  color,
  onPress,
  logLabel,
}: {
  done: boolean;
  color: string;
  onPress: () => void;
  /** Name shown in the tap log. */
  logLabel: string;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={() => {
        logTap(`${logLabel} → ${done ? 'uncheck' : 'check'}`);
        onPress();
      }}
      hitSlop={8}
      scaleTo={0.85}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      style={[
        styles.check,
        colorTransition,
        { borderColor: done ? color : theme.textMuted, backgroundColor: done ? color : 'transparent' },
      ]}>
      {done && (
        <Animated.Text
          entering={ZoomIn.springify()}
          exiting={ZoomOut.duration(Duration.fast)}
          style={[styles.checkMark, { color: theme.onAccent }]}>
          ✓
        </Animated.Text>
      )}
    </PressableScale>
  );
}

/** Segmented control with a pill that slides to the selected option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  color,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  color?: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const segmentWidth = width / options.length;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <View
      style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - SEGMENT_PADDING * 2)}>
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentPill,
            {
              width: segmentWidth,
              backgroundColor: color ?? theme.tint,
              transform: [{ translateX: index * segmentWidth }],
            },
            transition(['transform', 'backgroundColor'], Duration.base),
          ]}
        />
      )}
      {options.map((o) => (
        <PressableScale
          key={o.value}
          scaleTo={0.96}
          onPress={() => {
            logTap(`segment "${o.label}"`);
            onChange(o.value);
          }}
          style={styles.segment}>
          <Txt variant="label" tone={o.value === value ? 'onAccent' : 'text'}>
            {o.label}
          </Txt>
        </PressableScale>
      ))}
    </View>
  );
}

/** Seven round day toggles, Monday first. */
export function WeekdayPicker({
  value,
  onChange,
  color,
}: {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
  color?: string;
}) {
  const theme = useTheme();
  const accent = color ?? theme.tint;
  return (
    <View style={styles.weekRow}>
      {WEEK_ORDER.map((d) => {
        const selected = value.includes(d);
        return (
          <PressableScale
            key={d}
            scaleTo={0.88}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              logTap(`weekday ${d} (0=Sun) → ${selected ? 'off' : 'on'}`);
              onChange(selected ? value.filter((x) => x !== d) : [...value, d]);
            }}
            style={[
              styles.day,
              colorTransition,
              { backgroundColor: selected ? accent : theme.backgroundSelected },
            ]}>
            <Txt variant="label" tone={selected ? 'onAccent' : 'text'}>
              {WEEKDAY_LETTER[d]}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  color,
  disabled,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  variant?: 'solid' | 'soft';
}) {
  const theme = useTheme();
  const accent = color ?? theme.tint;
  const solid = variant === 'solid';
  return (
    <PressableScale
      onPress={() => {
        logTap(`button "${label}"`);
        onPress();
      }}
      disabled={disabled}
      scaleTo={0.97}
      style={[
        styles.primary,
        colorTransition,
        { backgroundColor: solid ? accent : withAlpha(accent, Alpha.soft), opacity: disabled ? 0.4 : 1 },
      ]}>
      <Txt variant="button" color={solid ? theme.onAccent : accent}>
        {label}
      </Txt>
    </PressableScale>
  );
}

const SEGMENT_PADDING = 4;

const center = { alignItems: 'center', justifyContent: 'center' } as const;

const styles = StyleSheet.create({
  page: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: Radius.card, padding: CardPadding, borderCurve: 'continuous' },
  sectionLabel: { marginBottom: Spacing.two },
  bubble: { borderRadius: Radius.pill, ...center },
  round: { borderRadius: Radius.pill, ...center },
  check: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 2, ...center },
  checkMark: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  segmented: { flexDirection: 'row', borderRadius: Radius.pill, padding: SEGMENT_PADDING },
  segmentPill: {
    position: 'absolute',
    top: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    left: SEGMENT_PADDING,
    borderRadius: Radius.pill,
  },
  segment: { flex: 1, height: 34, borderRadius: Radius.pill, ...center },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 38, height: 38, borderRadius: Radius.pill, ...center },
  primary: { height: 52, borderRadius: Radius.pill, ...center },
});
