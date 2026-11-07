import Storage from 'expo-sqlite/kv-store';

export async function loadItem(key: string): Promise<string | null> {
  return Storage.getItem(key);
}

export async function saveItem(key: string, value: string): Promise<void> {
  await Storage.setItem(key, value);
}
