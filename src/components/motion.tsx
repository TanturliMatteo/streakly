/**
 * Motion tokens: every duration, curve and spring in the app comes from here, so all
 * animations share the same rhythm.
 * Reanimated respects the system "reduce motion" setting by default.
 */
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export const Duration = {
  /** Colour changes, fades, small pops. */
  fast: 200,
  /** Sections expanding / collapsing, sliders. */
  base: 260,
  /** Pages sliding in and out (open, close and swipe-back all use this). */
  page: 280,
  /** Progress bars and charts filling up. */
  slow: 400,
  /** Confetti burst when the day is complete. */
  celebrate: 2400,
} as const;

/** Quick start, soft landing. Used for every timed movement. */
export const Ease = Easing.bezier(0.2, 0, 0, 1);

export const Springs = {
  /** Press-down / release of tappable elements. */
  press: { damping: 15, stiffness: 300, mass: 0.6 },
  /** Settling back after a drag that didn't complete. */
  settle: { damping: 20, stiffness: 240 },
} as const;

/** Layout animations for views that mount / unmount. */
export const Motion = {
  enter: FadeInDown.duration(Duration.base),
  fadeIn: FadeIn.duration(Duration.fast),
  exit: FadeOut.duration(Duration.fast),
  /** Staggered entrance for lists: item i waits i × 50 ms. */
  stagger: (index: number) => FadeInDown.duration(Duration.page).delay(Math.min(index, 8) * 50),
};

type TransitionStyle = {
  transitionProperty: string | string[];
  transitionDuration: number;
  transitionTimingFunction: 'ease-out';
};

/** Style that animates the given props whenever they change between renders (Animated views only). */
export function transition(property: string | string[], duration: number = Duration.fast): TransitionStyle {
  return { transitionProperty: property, transitionDuration: duration, transitionTimingFunction: 'ease-out' };
}

/** Background + border colour changes fade instead of snapping. */
export const colorTransition = transition(['backgroundColor', 'borderColor']);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far the element shrinks while pressed. */
  scaleTo?: number;
};

/** Pressable that springs down while pressed and back up on release. */
export function PressableScale({
  style,
  scaleTo = 0.95,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, Springs.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, Springs.press));
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    />
  );
}
