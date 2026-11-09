/**
 * Home-screen widget (Android), drawn with react-native-android-widget primitives.
 * Plain functions of their props: no hooks, no state. Same look as the app's cards.
 *
 * `TodayHabits`: habits due today; the round check on the right toggles done / not done,
 * tapping a habit opens it in the app, tapping the header opens the app.
 *
 * Everything is drawn as one picture (no scrolling `ListWidget`): the library renders at an
 * estimated size, and a separate list layer drifted out of the box whenever that estimate was
 * off (e.g. right after a resize). As one picture, box and cards always scale together. Rows
 * that don't fit the height are summed up in a "+N more" row that opens the app.
 *
 * The library calls these components as plain functions, outside a React render, so they must
 * not be compiled by the React Compiler (its memo cache is a hook and throws there).
 */
'use no memo';

import {
  FlexWidget,
  requestWidgetUpdate,
  TextWidget,
  type ColorProp,
  type WidgetInfo,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import { Alpha, Colors, withAlpha, type Theme } from '@/constants/theme';
import { logEvent } from '@/lib/debug-log';
import { dueToday, type TodayItem } from '@/lib/habit-data';
import { streakSubtitle } from '@/lib/habit-utils';

import type { WidgetSnapshot } from './snapshot';

/** Must match the widget names in app.json (`react-native-android-widget` plugin). */
const WIDGET_NAMES = ['TodayHabits'] as const;

/** Click action of a row's check button (`clickActionData: { id }`). */
export const TOGGLE_ACTION = 'TOGGLE_HABIT';

// Fixed heights (dp), so the number of rows that fit can be computed from the widget's height.
const PADDING = 12;
const GAP = 8;
const HEADER_HEIGHT = 24;
const ROW_HEIGHT = 52;
const MORE_HEIGHT = 24;
const RADIUS = 24;

/** How many rows fit in `height` (dp), leaving room for a "+N more" row when not all of them do. */
function visibleRows(height: number, count: number) {
  const space = height - 2 * PADDING - HEADER_HEIGHT - GAP;
  const fitting = (n: number) => n * ROW_HEIGHT + Math.max(0, n - 1) * GAP;
  if (fitting(count) <= space) return count;
  let n = 0;
  while (fitting(n + 1) + GAP + MORE_HEIGHT <= space) n++;
  if (n > 0) return n;
  // Too short for a row plus the "+N more" line: a card is more useful (the header has the count).
  while (n < count && fitting(n + 1) <= space) n++;
  return n;
}

const color = (c: string) => c as ColorProp;
const habitLink = (id: string) => `habitsapp://habit/${id}`;

function Header({ theme, done, due }: { theme: Theme; done: number; due: number }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: HEADER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
      }}>
      <TextWidget text="Today" style={{ fontSize: 18, fontWeight: '800', color: color(theme.text) }} />
      <FlexWidget style={{ flex: 1 }} />
      {due > 0 && (
        <TextWidget
          text={`${done}/${due}`}
          style={{ fontSize: 15, fontWeight: '700', color: color(done === due ? theme.tint : theme.textSecondary) }}
        />
      )}
    </FlexWidget>
  );
}

function HabitRow({ item, theme }: { item: TodayItem; theme: Theme }) {
  const { habit, state, streak } = item;
  const done = state === 'done';
  const subtitle = streakSubtitle(habit, streak);
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color(theme.backgroundElement),
        borderRadius: 18,
        paddingHorizontal: 10,
      }}>
      {/* Icon + texts: open the habit in the app. */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: habitLink(habit.id) }}
        style={{ flex: 1, height: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: 10 }}>
        <FlexWidget
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color(withAlpha(habit.color, Alpha.soft)),
          }}>
          <TextWidget text={habit.icon} style={{ fontSize: 17 }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget
            text={habit.name}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 15, fontWeight: '700', color: color(theme.text) }}
          />
          <TextWidget
            text={subtitle}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 12, fontWeight: '500', color: color(theme.textSecondary) }}
          />
        </FlexWidget>
      </FlexWidget>
      {/* Check: toggles today's done / not done. */}
      <FlexWidget
        clickAction={TOGGLE_ACTION}
        clickActionData={{ id: habit.id }}
        accessibilityLabel={done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
        style={{ height: 'match_parent', paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
        <FlexWidget
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: color(done ? habit.color : theme.textMuted),
            backgroundColor: color(done ? habit.color : 'rgba(0, 0, 0, 0)'),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {done && <TextWidget text="✓" style={{ fontSize: 16, fontWeight: '800', color: color(theme.onAccent) }} />}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/** Last row when not every habit fits: how many are hidden; opens the app. */
function MoreRow({ theme, count }: { theme: Theme; count: number }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ width: 'match_parent', height: MORE_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget
        text={`+${count} more · open app`}
        style={{ fontSize: 13, fontWeight: '600', color: color(theme.textSecondary) }}
      />
    </FlexWidget>
  );
}

function Message({ theme, text }: { theme: Theme; text: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ width: 'match_parent', height: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text={text} style={{ fontSize: 14, fontWeight: '600', color: color(theme.textSecondary), textAlign: 'center' }} />
    </FlexWidget>
  );
}

function Shell({ theme, children }: { theme: Theme; children: unknown }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        flexGap: GAP,
        padding: PADDING,
        borderRadius: RADIUS,
        backgroundColor: color(theme.background),
      }}>
      {children}
    </FlexWidget>
  );
}

function TodayHabitsWidget({
  snapshot,
  theme,
  height,
}: {
  snapshot: WidgetSnapshot | null;
  theme: Theme;
  /** Widget height in dp, to know how many rows fit. */
  height: number;
}) {
  if (!snapshot) {
    return (
      <Shell theme={theme}>
        <Message theme={theme} text="Couldn’t load your habits. Tap to open the app." />
      </Shell>
    );
  }
  const { items, done } = dueToday(snapshot.data, snapshot.today);
  const empty =
    snapshot.data.habits.length === 0 ? 'No habits yet. Tap to add one.' : 'Rest day, nothing due 🌙';
  const shown = items.slice(0, visibleRows(height, items.length));
  const hidden = items.length - shown.length;
  return (
    <Shell theme={theme}>
      <Header theme={theme} done={done} due={items.length} />
      {/* Plain arrays, not fragments: the library can't build a tree from `<>`. */}
      {items.length === 0 && <Message theme={theme} text={empty} />}
      {shown.map((item) => (
        <HabitRow key={item.habit.id} item={item} theme={theme} />
      ))}
      {hidden > 0 && <MoreRow theme={theme} count={hidden} />}
    </Shell>
  );
}

/** The widget for `info`, in the app's theme: light / dark following the system, or forced. */
export function renderWidgetFor(info: WidgetInfo, snapshot: WidgetSnapshot | null): WidgetRepresentation {
  const build = (theme: Theme) => <TodayHabitsWidget snapshot={snapshot} theme={theme} height={info.height} />;
  const pref = snapshot?.theme ?? 'system';
  if (pref === 'light') return build(Colors.light);
  if (pref === 'dark') return build(Colors.dark);
  return { light: build(Colors.light), dark: build(Colors.dark) };
}

/** Redraws every placed widget with `snapshot`. Never throws: failures are logged. */
export async function redrawAllWidgets(snapshot: WidgetSnapshot | null) {
  await Promise.all(
    WIDGET_NAMES.map((widgetName) =>
      requestWidgetUpdate({ widgetName, renderWidget: (info) => renderWidgetFor(info, snapshot) }).catch((e) =>
        logEvent('error', `widget: redrawing ${widgetName} failed: ${String(e)}`),
      ),
    ),
  );
}
