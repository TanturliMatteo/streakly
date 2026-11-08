/**
 * Link between the widget task handler and the running app.
 *
 * Widget taps run as a background task in the app's JS runtime. If the app's UI is alive, the
 * habits store registers a handler here and the tap goes through its state; otherwise the
 * widget task updates storage directly (the app reads it on its next start).
 */
type ToggleHandler = (habitId: string) => void;

let toggleHandler: ToggleHandler | null = null;

export function setWidgetToggleHandler(handler: ToggleHandler | null) {
  toggleHandler = handler;
}

/** Returns true if the running app handled the toggle. */
export function toggleInApp(habitId: string): boolean {
  if (!toggleHandler) return false;
  toggleHandler(habitId);
  return true;
}
