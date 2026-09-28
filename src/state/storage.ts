// Pairing keys live in the platform keystore (Keychain / Android Keystore).
// Web is for development previews only and falls back to localStorage.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const web = Platform.OS === 'web';

export async function load<T>(key: string): Promise<T | null> {
  try {
    const raw = web ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  if (web) {
    try { globalThis.localStorage?.setItem(key, raw); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, raw, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
}

export async function remove(key: string): Promise<void> {
  if (web) {
    try { globalThis.localStorage?.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
