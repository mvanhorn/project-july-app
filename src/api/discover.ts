// Find june-local on the home network. The oven doesn't announce itself (no mDNS
// or broadcast; june-local's own docs say so), so the phone asks every address on
// its Wi-Fi network (the /24 it is on) for june-local's status page, on both of
// its plain ports. A few seconds, since most addresses don't answer at all.
import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { findJuneLocal, type LocalStatus } from './endpoint';

export type Found = { host: string; httpPort: number; status: LocalStatus };

const PARALLEL = 48;
const WAIT_MS = 1500;

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
  const total = 254;
  const found: Found[] = [];
  let next = 1;
  let done = 0;
  const worker = async () => {
    while (next <= total && !opts.signal?.aborted) {
      const host = `${prefix}.${next++}`;
      const hit = await findJuneLocal(host, WAIT_MS);
      if (opts.signal?.aborted) return;
      opts.onProgress?.(++done, total);
      if (hit) {
        const f = { host, ...hit };
        found.push(f);
        opts.onFound?.(f);
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return found;
}
