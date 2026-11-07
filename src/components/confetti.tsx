/**
 * Confetti burst: pieces shoot up and out, then fall with gravity, spinning and
 * swaying, and fade out at the end. Purely transform/opacity animation on the UI thread.
 *
 * Pieces burst from the upper-middle of the screen.
 * Skipped entirely when the system "reduce motion" setting is on.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { HabitColors } from '@/constants/theme';
import { logEvent } from '@/lib/debug-log';
import { useHabits } from '@/lib/habits-store';

import { Duration } from './motion';

const PIECES = 48;
const GRAVITY = 1400; // px/s²
const SECONDS = Duration.celebrate / 1000;
const FADE_SECONDS = 0.5;

type Piece = {
  color: string;
  width: number;
  height: number;
  round: boolean;
  vx: number; // px/s
  vy: number; // px/s (negative = up)
  spin: number; // deg/s
  wobble: number; // rad/s
};

const random = (min: number, max: number) => min + Math.random() * (max - min);

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => {
    const round = i % 4 === 0;
    const size = random(7, 11);
    return {
      color: HabitColors[i % HabitColors.length],
      width: size,
      height: round ? size : size * 1.6,
      round,
      vx: random(-320, 320),
      vy: random(-1050, -550),
      spin: random(-720, 720),
      wobble: random(4, 9),
    };
  });
}

/**
 * App-wide overlay (mounted once at the root): plays a burst every time the store reports that
 * all of today's habits were just completed, whichever screen you did it from.
 */
export function Celebration() {
  const { celebration } = useHabits();
  const [finished, setFinished] = useState(0);
  if (celebration === 0 || finished === celebration) return null;
  return <Confetti key={celebration} onDone={() => setFinished(celebration)} />;
}

function Confetti({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [pieces] = useState(makePieces);
  const t = useSharedValue(0); // elapsed seconds
  const from = { x: width / 2, y: height * 0.3 };

  useEffect(() => {
    if (reduceMotion) {
      logEvent('action', 'confetti skipped: system "reduce motion" / "remove animations" is on');
      onDone();
      return;
    }
    t.set(
      withTiming(SECONDS, { duration: Duration.celebrate, easing: Easing.linear }, () => {
        scheduleOnRN(onDone);
      }),
    );
    // Fire once per mount; a new burst is a new mount (new `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <ConfettiPiece key={i} piece={p} t={t} x0={from.x} y0={from.y} />
      ))}
    </View>
  );
}

function ConfettiPiece({
  piece,
  t,
  x0,
  y0,
}: {
  piece: Piece;
  t: SharedValue<number>;
  x0: number;
  y0: number;
}) {
  const style = useAnimatedStyle(() => {
    const s = t.get();
    return {
      opacity: s > SECONDS - FADE_SECONDS ? (SECONDS - s) / FADE_SECONDS : 1,
      transform: [
        { translateX: x0 + piece.vx * s + Math.sin(s * piece.wobble) * 14 },
        { translateY: y0 + piece.vy * s + 0.5 * GRAVITY * s * s },
        { rotate: `${piece.spin * s}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: piece.width,
          height: piece.height,
          marginLeft: -piece.width / 2,
          backgroundColor: piece.color,
          borderRadius: piece.round ? piece.width / 2 : 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
});
