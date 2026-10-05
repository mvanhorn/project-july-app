// Find june-local on the home network. The oven doesn't announce itself (no mDNS
// or broadcast; june-local's own docs say so), so the phone asks every address on
// its Wi-Fi network (the /24 it is on) for june-local's status page: port 80 (the
// oven) first, then 8080 (the reference server) if nothing answered. See scan.ts
// for why it is one port at a time.
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { PLAIN_PORTS, statusAt } from './endpoint';
import { sweep, type Found } from './scan';

export type { Found };

// Under OkHttp's 64 requests in flight, leaving room for anything else the app sends.
const PARALLEL = 40;
const WAIT_MS = 2000;

/** A private home-network address (10/8, 172.16/12, 192.168/16): the only kind the scan may look through. */
export function isPrivateIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}

/**
 * The first three parts of this phone's address on its home network ("192.168.1"),
 * or null when there is none to search: not on Wi-Fi or Ethernet, not a private
 * address, or on the web (where expo-network reports the public address, from an
 * outside service).
 */
export async function networkPrefix(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.type !== Network.NetworkStateType.WIFI && state.type !== Network.NetworkStateType.ETHERNET) return null;
    const ip = await Network.getIpAddressAsync();
    if (!isPrivateIPv4(ip)) return null;
    return ip.split('.').slice(0, 3).join('.');
  } catch {
    return null;
  }
}

export async function scan(prefix: string, opts: {
  onProgress?: (done: number, total: number) => void;
  onFound?: (f: Found) => void;
  signal?: AbortSignal;
}): Promise<Found[]> {
  // Never look through anything but a private home network.
  if (!isPrivateIPv4(`${prefix}.1`)) return [];
  return sweep(prefix, PLAIN_PORTS, statusAt, {
    parallel: PARALLEL,
    timeoutMs: WAIT_MS,
    onProgress: (done, total) => opts.onProgress?.(done, total),
    onFound: opts.onFound,
    signal: opts.signal,
  });
}
