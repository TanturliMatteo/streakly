/**
 * Home list of habit cards with three gestures on each card:
 *
 * - Hold (~0.35 s) → the card lifts and follows the finger; the others slide out of its way
 *   live. Cards only move within their group (due today / rest day). Drop saves the order.
 * - Swipe right past 20% → a red "Delete" is revealed behind the card and the in-app delete
 *   confirmation opens (Cancel slides the card back).
 * - Every release slides into place on the shared timing curve (no springs, no bounce).
 * - Swipe left past 28% → opens "Edit habit" (an edit colour is revealed behind the card).
 * - A card never slides further than half its width.
 *
 * Rows are absolutely positioned from a shared `order` (UI thread), so React re-rendering in
 * the new order after a drop lands exactly where the cards already are: no jump.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logEvent, logTap } from '@/lib/debug-log';
import type { DayState, Habit, HabitLog } from '@/lib/types';

import { ConfirmDialog } from './confirm-dialog';
import { HabitCard } from './habit-card';
import { Motion, Timing } from './motion';
import { Txt } from './ui';

const GAP = Spacing.three;
const SLIDE = Timing.page;
/** Lift / set-down of a dragged card. */
const LIFT = Timing.fast;
/** How long to hold before a card can be dragged. */
const HOLD_MS = 350;
/** Swipe right past this fraction of the card (or flick) to ask to delete. */
const DELETE_FRACTION = 0.2;
/** Where the card rests while the delete confirmation is open: wide enough for "🗑️ Delete". */
const DELETE_REST = 132;
/** Swipe left past this fraction of the card (or flick) to open "Edit habit". */
const EDIT_FRACTION = 0.28;
/** A card can't slide further than this fraction of its width either way. */
const MAX_SWIPE_FRACTION = 0.5;
const FLICK_VELOCITY = 800;
/** How much bigger a lifted card gets. */
const LIFT_SCALE = 0.04;

export type HabitListItem = { habit: Habit; state: DayState };

type Shared = {
  order: SharedValue<string[]>;
  heights: SharedValue<Record<string, number>>;
  groups: SharedValue<Record<string, number>>;
  dragStartOrder: SharedValue<string[]>;
};

/** Top of `key`'s slot in the current order (null until it and every card above are measured). */
function slotTop(order: string[], heights: Record<string, number>, key: string): number | null {
  'worklet';
  let top = 0;
  for (const k of order) {
    const h = heights[k];
    if (h == null) return null;
    if (k === key) return top;
    top += h + GAP;
  }
  return null;
}

export function HabitList({
  items,
  logs,
  today,
  onToggle,
  onReorder,
  onDelete,
}: {
  items: HabitListItem[];
  logs: Record<string, HabitLog>;
  today: string;
  onToggle: (item: HabitListItem) => void;
  /** New order of one group's habit ids. */
  onReorder: (ids: string[]) => void;
  onDelete: (habit: Habit) => void;
}) {
  const order = useSharedValue<string[]>([]);
  const heights = useSharedValue<Record<string, number>>({});
  const groups = useSharedValue<Record<string, number>>({});
  const dragStartOrder = useSharedValue<string[]>([]);
  const shared: Shared = { order, heights, groups, dragStartOrder };

  // Rest-day habits form their own group at the bottom.
  const keys = items.map((i) => i.habit.id);
  const keysText = keys.join('|');
  const groupsText = items.map((i) => (i.state === 'off' ? 1 : 0)).join('|');
  useEffect(() => {
    const ids = keysText ? keysText.split('|') : [];
    const g = groupsText.split('|');
    groups.set(Object.fromEntries(ids.map((id, i) => [id, Number(g[i])])));
    order.set(ids);
  }, [keysText, groupsText, order, groups]);

  const total = useSharedValue(0);
  useAnimatedReaction(
    () => {
      const h = heights.get();
      const o = order.get();
      return o.reduce((sum, k, i) => sum + (h[k] ?? 0) + (i > 0 ? GAP : 0), 0);
    },
    (t) => total.set(t),
  );
  const containerStyle = useAnimatedStyle(() => ({ height: total.get() }));

  // Delete confirmation. `pending` outlives `confirmOpen` so the dialog keeps its text while fading out.
  const theme = useTheme();
  const [pending, setPending] = useState<{ habit: Habit; slideBack: () => void } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const requestDelete = (habit: Habit, slideBack: () => void) => {
    setPending({ habit, slideBack });
    setConfirmOpen(true);
  };

  return (
    <Animated.View style={containerStyle}>
      {items.map((item, index) => (
        <HabitRow
          key={item.habit.id}
          item={item}
          index={index}
          log={logs[item.habit.id] ?? {}}
          today={today}
          shared={shared}
          total={total}
          onToggle={() => onToggle(item)}
          onReorder={onReorder}
          onRequestDelete={requestDelete}
        />
      ))}
      <ConfirmDialog
        open={confirmOpen}
        icon={pending?.habit.icon}
        color={theme.danger}
        title={`Delete “${pending?.habit.name ?? ''}”?`}
        message="Its streak and history will be deleted too. This can’t be undone."
        confirmLabel="Delete habit"
        onCancel={() => {
          setConfirmOpen(false);
          pending?.slideBack();
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          if (pending) onDelete(pending.habit);
        }}
      />
    </Animated.View>
  );
}

function HabitRow({
  item,
  index,
  log,
  today,
  shared,
  total,
  onToggle,
  onReorder,
  onRequestDelete,
}: {
  item: HabitListItem;
  index: number;
  log: HabitLog;
  today: string;
  shared: Shared;
  total: SharedValue<number>;
  onToggle: () => void;
  onReorder: (ids: string[]) => void;
  onRequestDelete: (habit: Habit, slideBack: () => void) => void;
}) {
  const theme = useTheme();
  const { habit } = item;
  const key = habit.id;
  const { order, heights, groups, dragStartOrder } = shared;

  const y = useSharedValue(0); // row top
  const x = useSharedValue(0); // card swipe offset
  const width = useSharedValue(0);
  const placed = useSharedValue(false);
  const dragging = useSharedValue(false);
  const lift = useSharedValue(0);
  const startY = useSharedValue(0);
  const startX = useSharedValue(0);

  // Follow this card's slot: placed instantly the first time, then slides when the order changes.
  useAnimatedReaction(
    () => slotTop(order.get(), heights.get(), key),
    (top, prev) => {
      if (top === null || dragging.get()) return;
      if (!placed.get()) {
        y.set(top);
        placed.set(true);
      } else if (top !== prev) {
        y.set(withTiming(top, SLIDE));
      }
    },
  );

  const slideBack = () => x.set(withTiming(0, SLIDE));
  const openEdit = () => {
    logTap(`swipe left → edit "${habit.name}"`);
    router.push({ pathname: '/edit/[id]', params: { id: key } });
  };
  const askDelete = () => {
    logTap(`swipe right → delete "${habit.name}"?`);
    onRequestDelete(habit, slideBack);
  };
  const commitOrder = (ids: string[]) => onReorder(ids);
  const logDrag = () => logTap(`hold → drag "${habit.name}"`);
  // Haptics: a firm bump when the card lifts, a light tick each time it passes another card.
  const liftHaptic = () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((e) =>
      logEvent('error', `haptics failed: ${String(e)}`),
    );
  const tickHaptic = () =>
    Haptics.selectionAsync().catch((e) => logEvent('error', `haptics failed: ${String(e)}`));

  /**
   * Moves this card one slot up / down when its top (bottom) edge passes a neighbour's middle.
   * Edges, not centres: a card held at the very top / bottom of the list can still reach the
   * first / last slot. Swapping back needs an extra GAP of travel, so it never flickers.
   */
  const maybeSwap = (top: number) => {
    'worklet';
    const o = order.get();
    const h = heights.get();
    const g = groups.get();
    const i = o.indexOf(key);
    const bottom = top + h[key];
    const swap = (a: number, b: number) => {
      const next = [...o];
      [next[a], next[b]] = [next[b], next[a]];
      order.set(next);
      scheduleOnRN(tickHaptic);
    };
    const above = o[i - 1];
    if (above !== undefined && g[above] === g[key]) {
      const t = slotTop(o, h, above);
      if (t !== null && top < t + h[above] / 2) return swap(i - 1, i);
    }
    const below = o[i + 1];
    if (below !== undefined && g[below] === g[key]) {
      const t = slotTop(o, h, below);
      if (t !== null && bottom > t + h[below] / 2) swap(i, i + 1);
    }
  };

  const drag = usePanGesture({
    activateAfterLongPress: HOLD_MS,
    onActivate: () => {
      'worklet';
      dragging.set(true);
      startY.set(y.get());
      dragStartOrder.set(order.get());
      lift.set(withTiming(1, LIFT));
      x.set(withTiming(0, SLIDE));
      scheduleOnRN(logDrag);
      scheduleOnRN(liftHaptic);
    },
    onUpdate: (e) => {
      'worklet';
      const maxTop = Math.max(0, total.get() - (heights.get()[key] ?? 0));
      const top = Math.min(maxTop, Math.max(0, startY.get() + e.translationY));
      y.set(top);
      maybeSwap(top);
    },
    onFinalize: () => {
      'worklet';
      if (!dragging.get()) return;
      lift.set(withTiming(0, LIFT));
      const o = order.get();
      const target = slotTop(o, heights.get(), key) ?? startY.get();
      y.set(withTiming(target, SLIDE, () => dragging.set(false)));
      if (o.join('|') !== dragStartOrder.get().join('|')) {
        const g = groups.get();
        scheduleOnRN(
          commitOrder,
          o.filter((k) => g[k] === g[key]),
        );
      }
    },
  });

  const swipe = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-10, 10],
    onActivate: () => {
      'worklet';
      startX.set(x.get());
    },
    onUpdate: (e) => {
      'worklet';
      const max = width.get() * MAX_SWIPE_FRACTION;
      x.set(Math.min(max, Math.max(-max, startX.get() + e.translationX)));
    },
    onDeactivate: (e) => {
      'worklet';
      const nx = x.get();
      const w = width.get();
      if (nx < -w * EDIT_FRACTION || (nx < -40 && e.velocityX < -FLICK_VELOCITY)) {
        x.set(withTiming(0, SLIDE));
        scheduleOnRN(openEdit);
      } else if (nx > w * DELETE_FRACTION || (nx > 40 && e.velocityX > FLICK_VELOCITY)) {
        // Rest with the trash showing while the confirmation is open.
        x.set(withTiming(Math.min(DELETE_REST, w * MAX_SWIPE_FRACTION), SLIDE));
        scheduleOnRN(askDelete);
      } else {
        x.set(withTiming(0, SLIDE));
      }
    },
  });

  const gesture = useCompetingGestures(drag, swipe);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: placed.get() ? 1 : 0,
    zIndex: dragging.get() ? 10 : 0,
    transform: [{ translateY: y.get() }, { scale: 1 + LIFT_SCALE * lift.get() }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    elevation: 12 * lift.get(),
    shadowOpacity: 0.2 * lift.get(),
    transform: [{ translateX: x.get() }],
  }));
  const deleteStyle = useAnimatedStyle(() => ({ opacity: x.get() > 0 ? 1 : 0 }));
  const editStyle = useAnimatedStyle(() => ({ opacity: x.get() < 0 ? 1 : 0 }));

  return (
    <Animated.View
      exiting={Motion.exit}
      style={[styles.row, rowStyle]}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        width.set(e.nativeEvent.layout.width);
        // Merge on the UI thread: rows measured in the same frame must not overwrite each
        // other with a stale copy read from JS (which left cards unmeasured, i.e. invisible).
        heights.modify((all) => {
          'worklet';
          return all[key] === h ? all : { ...all, [key]: h };
        });
      }}>
      {/* Actions revealed behind the card. */}
      <Animated.View style={[styles.behind, styles.deleteBehind, { backgroundColor: theme.danger }, deleteStyle]}>
        <Txt variant="button" tone="onAccent">
          🗑️ Delete
        </Txt>
      </Animated.View>
      <Animated.View style={[styles.behind, styles.editBehind, { backgroundColor: theme.tint }, editStyle]}>
        <Txt variant="button" tone="onAccent">
          ✏️ Edit
        </Txt>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.front, { backgroundColor: theme.background }, frontStyle]}>
          <Animated.View entering={Motion.stagger(index + 1)}>
            <HabitCard habit={habit} log={log} today={today} state={item.state} onToggle={onToggle} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', top: 0, left: 0, right: 0 },
  behind: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBehind: { paddingLeft: Spacing.four },
  editBehind: { justifyContent: 'flex-end', paddingRight: Spacing.four },
  front: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
});
