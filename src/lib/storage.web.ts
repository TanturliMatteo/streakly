// On web, use localStorage (expo-sqlite on web needs extra wasm/COOP headers setup).

export async function loadItem(key: string): Promise<string | null> {
  return loadItemSync(key);
}

export function loadItemSync(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export async function saveItem(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}
