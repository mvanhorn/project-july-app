// noble crypto reads randomness from globalThis.crypto.getRandomValues, which
// Hermes does not provide. Back it with the platform CSPRNG via expo-crypto.
import { getRandomValues } from 'expo-crypto';

const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.getRandomValues !== 'function') {
  g.crypto.getRandomValues = getRandomValues;
}
