import Storage from 'expo-sqlite/kv-store';

export async function loadItem(key: string): Promise<string | null> {
  return Storage.getItem(key);
}

/** Synchronous read, for the few values needed before the first frame (e.g. the theme). */
export function loadItemSync(key: string): string | null {
  return Storage.getItemSync(key);
}

export async function saveItem(key: string, value: string): Promise<void> {
  await Storage.setItem(key, value);
}
