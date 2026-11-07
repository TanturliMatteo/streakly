/**
 * Tiny breadcrumb logger (development builds only).
 *
 * Every tap, screen change and store action is printed to the Metro terminal as
 *   [habits 14:03:22.120] tap      Create habit
 * and kept in a ring buffer. When an error happens, the last breadcrumbs are printed with it,
 * so the path that led to a bug can be copied straight from the terminal.
 */

type Kind = 'tap' | 'nav' | 'action' | 'error';
type Entry = { at: string; kind: Kind; message: string };

const MAX_ENTRIES = 50;
const entries: Entry[] = [];

function timestamp() {
  const d = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function format(e: Entry) {
  return `[habits ${e.at}] ${e.kind.padEnd(6)} ${e.message}`;
}

export function logEvent(kind: Kind, message: string) {
  if (!__DEV__) return;
  const entry = { at: timestamp(), kind, message };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  if (kind === 'error') {
    console.warn(`${format(entry)}\n--- last steps before this error ---\n${dumpLog()}`);
  } else {
    console.log(format(entry));
  }
}

export const logTap = (label: string) => logEvent('tap', label);

function dumpLog() {
  return entries.map(format).join('\n');
}

/** Prints breadcrumbs for uncaught JS errors too (keeps the default red screen). */
export function installGlobalErrorLogging() {
  if (!__DEV__) return;
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    logEvent('error', `${isFatal ? 'FATAL ' : ''}${String(error)}`);
    previous(error, isFatal);
  });
}

type ErrorUtilsLike = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};
