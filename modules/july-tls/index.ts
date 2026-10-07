// Per-host certificate trust for fetch and WebSocket (see android/…/JulyTrust.kt and
// ios/JulyTrust.swift). Native code, so it is missing in Expo Go and on the web:
// there `available` is false and the calls do nothing.
import { requireOptionalNativeModule } from 'expo';

type Native = {
  setTrust(host: string, caPem: string | null, insecure: boolean): void;
  clearTrust(host: string): void;
};

const native = requireOptionalNativeModule<Native>('JulyTls');

export const available = native !== null;

/** Trust `host`'s certificate if it leads to `caPem`, or (insecure) whatever it is. */
export function setTrust(host: string, caPem: string | null, insecure: boolean): void {
  native?.setTrust(host, caPem, insecure);
}

export function clearTrust(host: string): void {
  native?.clearTrust(host);
}
