// The oven's home certificate. june-local can serve a certificate signed by the
// home's own CA (ca.crt from generate_certs.sh). A phone that hasn't installed that
// CA refuses it, and the app falls back to the plain port. Instead, people can give
// the app the ca.crt (pasted or picked), or opt in to not checking at all.
// Applied per host by the native JulyTls module (missing in Expo Go and on the web).
import { sha256 } from '@noble/hashes/sha2.js';
import * as JulyTls from '../../modules/july-tls';
import { fromB64, toB64 } from './protocol';

export type Trust = {
  /** The home CA, PEM. */
  caPem: string | null;
  /** Accept the oven's certificate without checking it. */
  insecure: boolean;
};

export const NO_TRUST: Trust = { caPem: null, insecure: false };
export const tlsAvailable = JulyTls.available;

export const hasTrust = (t: Trust | null | undefined): t is Trust => !!t && (!!t.caPem || t.insecure);

/** Make fetch and WebSocket to `host` follow `trust` (or the phone's own trust only). */
export function applyTrust(host: string, trust: Trust | null): void {
  if (hasTrust(trust)) JulyTls.setTrust(host, trust.caPem, trust.insecure);
  else JulyTls.clearTrust(host);
}

export type CaInfo = { pem: string; name: string | null; sha256: string };

const PEM = /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+?)-----END CERTIFICATE-----/;

// PEM and certificate names are ASCII; Hermes has no TextDecoder.
const ascii = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');

/** A certificate as PEM, from pasted text, a PEM file or a DER (binary) file. */
export function readCa(input: string | Uint8Array): CaInfo | { error: string } {
  let der: Uint8Array;
  if (typeof input === 'string') {
    const m = input.match(PEM);
    if (!m) return { error: 'That doesn’t look like a certificate. It should start with -----BEGIN CERTIFICATE-----.' };
    der = fromB64(m[1]);
  } else {
    const text = ascii(input.subarray(0, 64 * 1024));
    if (PEM.test(text)) return readCa(text);
    der = input;
  }
  // DER starts with a SEQUENCE (0x30); anything else isn't a certificate.
  if (der.length < 100 || der[0] !== 0x30) return { error: 'That file isn’t a certificate. Look for ca.crt from your oven’s installer.' };
  const b64 = toB64(der);
  const pem = `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----\n`;
  const hash = Array.from(sha256(der), (b) => b.toString(16).padStart(2, '0').toUpperCase());
  return { pem, name: commonName(der), sha256: hash.join(':') };
}

/** The subject's common name (the second CN: the issuer's comes first), for display only. */
function commonName(der: Uint8Array): string | null {
  const names: string[] = [];
  for (let i = 0; i + 6 < der.length; i++) {
    // OID 2.5.4.3 (commonName), then a string type and a short length.
    if (der[i] === 0x06 && der[i + 1] === 0x03 && der[i + 2] === 0x55 && der[i + 3] === 0x04 && der[i + 4] === 0x03) {
      const len = der[i + 6];
      if (len < 0x80) names.push(ascii(der.subarray(i + 7, i + 7 + len)));
    }
  }
  return names[1] ?? names[0] ?? null;
}

/** "AB:CD:EF:…" short enough to read aloud and compare. */
export const shortFingerprint = (sha: string) => `${sha.split(':').slice(0, 8).join(':')}…`;
