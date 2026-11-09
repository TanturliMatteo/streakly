/**
 * Home-screen widgets (Android), drawn with react-native-android-widget primitives.
 * Plain functions of their props: no hooks, no state. Same look as the app's cards.
 *
 * - `TodayHabits`: habits due today; the round check on the right toggles done / not done,
 *   tapping a habit opens it in the app, tapping the header opens the app.
 * - `TodayRing`: a progress ring with today's done / due count.
 *
 * The library calls these components as plain functions, outside a React render, so they must
 * not be compiled by the React Compiler (its memo cache is a hook and throws there).
 */
'use no memo';

import {
  FlexWidget,
  ListWidget,
  OverlapWidget,
  requestWidgetUpdate,
  SvgWidget,
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
const WIDGET_NAMES = ['TodayHabits', 'TodayRing'] as const;

/** Click action of a row's check button (`clickActionData: { id }`). */
export const TOGGLE_ACTION = 'TOGGLE_HABIT';

const ROW_HEIGHT = 60;
const RADIUS = 24;

const color = (c: string) => c as ColorProp;
const habitLink = (id: string) => `habitsapp://habit/${id}`;

function Header({ theme, done, due }: { theme: Theme; done: number; due: number }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
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
    <FlexWidget style={{ width: 'match_parent', height: ROW_HEIGHT, paddingBottom: 8 }}>
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
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
        flexGap: 8,
        padding: 12,
        borderRadius: RADIUS,
        backgroundColor: color(theme.background),
      }}>
      {children}
    </FlexWidget>
  );
}

function TodayHabitsWidget({ snapshot, theme }: { snapshot: WidgetSnapshot | null; theme: Theme }) {
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
  return (
    <Shell theme={theme}>
      <Header theme={theme} done={done} due={items.length} />
      {items.length === 0 ? (
        <Message theme={theme} text={empty} />
      ) : (
        <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
          {items.map((item) => (
            <HabitRow key={item.habit.id} item={item} theme={theme} />
          ))}
        </ListWidget>
      )}
    </Shell>
  );
}

/** SVG progress ring: muted track + accent arc starting at 12 o'clock. */
function ringSvg(size: number, progress: number, track: string, accent: string) {
  const stroke = Math.max(8, Math.round(size * 0.1));
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const arc = Math.max(0, Math.min(1, progress)) * circumference;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
${arc > 0 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${accent}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${arc} ${circumference}" transform="rotate(-90 ${c} ${c})"/>` : ''}
</svg>`;
}

function TodayRingWidget({
  snapshot,
  theme,
  size,
}: {
  snapshot: WidgetSnapshot | null;
  theme: Theme;
  size: number;
}) {
  const counts = snapshot ? dueToday(snapshot.data, snapshot.today) : null;
  const due = counts?.items.length ?? 0;
  const done = counts?.done ?? 0;
  const label = !snapshot ? 'Tap to open' : due === 0 ? 'Rest day' : done === due ? 'All done 🎉' : 'today';
  const ring = Math.max(64, Math.floor(size - 24));
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS,
        backgroundColor: color(theme.background),
      }}>
      <OverlapWidget style={{ width: ring, height: ring }}>
        <SvgWidget
          svg={ringSvg(ring, due === 0 ? 0 : done / due, theme.backgroundSelected, theme.tint)}
          style={{ width: ring, height: ring }}
        />
        <FlexWidget
          style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <TextWidget
            text={snapshot ? `${done}/${due}` : '–'}
            style={{ fontSize: Math.round(ring * 0.24), fontWeight: '800', color: color(theme.text) }}
          />
          <TextWidget
            text={label}
            style={{ fontSize: Math.max(10, Math.round(ring * 0.1)), fontWeight: '600', color: color(theme.textSecondary) }}
          />
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}

/** The widget for `info`, in the app's theme: light / dark following the system, or forced. */
export function renderWidgetFor(info: WidgetInfo, snapshot: WidgetSnapshot | null): WidgetRepresentation {
  const build = (theme: Theme) =>
    info.widgetName === 'TodayRing' ? (
      <TodayRingWidget snapshot={snapshot} theme={theme} size={Math.min(info.width, info.height)} />
    ) : (
      <TodayHabitsWidget snapshot={snapshot} theme={theme} />
    );
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
