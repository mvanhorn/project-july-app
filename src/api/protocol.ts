// June wire protocol: SRP-6a pairing, NaCl sealing, Ed25519-signed frames.
// Ported from ha-june-oven/custom_components/june_oven/protocol.py (tested
// against a real oven).
import { sha1 } from '@noble/hashes/legacy.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { dammCheck } from './pairingCode';

export const APP_VERSION = '1.24.1.11';
export const PLATFORM_VERSION = '34';
// Constants from the stock June Android app; they identify the app, not a user.
export const CLIENT_ID = 'dcxqbcv2dY-G12elqDoAhCP8E12V0zC8XWThT-4U';
export const CLIENT_SECRET = 'tmoSUwt3OOZCcfMaIadAGD7-x-qPht85HkCgdvuhTKk1yFtfMcfJEyd';

export const MC = {
  VideoFrame: 10011, Notification: 10012, CookingState: 10013, CookPlanStarted: 10014,
  CookPlanEnded: 10017, DeviceState: 10018, Ack: 10020, Unpaired: 10022,
  PairingInfo: 10026, PairingInvalidated: 10027,
  Preheat: 11002, Cancel: 11004, SetCavityTemp: 11005, SetTimer: 11006, SetProbeTarget: 11007,
  Ping: 11011, Unpair: 11012, KeepCooking: 11013, SetCookMode: 11015,
} as const;

// --- bytes / base64 ----------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0, acc = 0, j = 0;
  for (const ch of clean) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[j++] = (acc >> bits) & 0xff; }
  }
  return out.subarray(0, j);
}

export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const utf8 = (s: string) => new TextEncoder().encode(s);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// --- big integers ------------------------------------------------------------

function bytesToBig(b: Uint8Array): bigint {
  return b.length ? BigInt('0x' + toHex(b)) : 0n;
}

/** Minimal unsigned big-endian encoding, left-padded to `min` bytes. */
function bigToBytes(n: bigint, min = 0): Uint8Array {
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const raw = fromHex(hex);
  if (raw.length >= min) return raw;
  const out = new Uint8Array(min);
  out.set(raw, min - raw.length);
  return out;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

// --- SRP-6a (BouncyCastle SRP6Server compatible) -----------------------------

// RFC 5054 8192-bit group, used with generator 19 by the June app.
export const SRP_N = BigInt('0x' + [
  'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74',
  '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437',
  '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED',
  'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05',
  '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB',
  '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B',
  'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718',
  '3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33',
  'A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7',
  'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864',
  'D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2',
  '08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A92108011A723C12A787E6D7',
  '88719A10BDBA5B2699C327186AF4E23C1A946834B6150BDA2583E9CA2AD44CE8',
  'DBBBC2DB04DE8EF92E8EFC141FBECAA6287C59474E6BC05D99B2964FA090C3A2',
  '233BA186515BE7ED1F612970CEE2D7AFB81BDD762170481CD0069127D5B05AA9',
  '93B4EA988D8FDDC186FFB7DC90A6C08F4DF435C93402849236C3FAB4D27C7026',
  'C1D4DCB2602646DEC9751E763DBA37BDF8FF9406AD9E530EE5DB382F413001AE',
  'B06A53ED9027D831179727B0865A8918DA3EDBEBCF9B14ED44CE6CBACED4BB1B',
  'DB7F1447E6CC254B332051512BD7AF426FB8F401378CD2BF5983CA01C64B92EC',
  'F032EA15D1721D03F482D7CE6E74FEF6D55E702F46980C82B5A84031900B1C9E',
  '59E7C97FBEC7E8F323A97A7E36CC88BE0F1D45B7FF585AC54BD407B22B4154AA',
  'CC8F6D7EBF48E1D814CC5ED20F8037E0A79715EEF29BE32806A1D58BB7C5DA76',
  'F550AA3D8A1FBFF0EB19CCB1A313D55CDA56C9EC2EF29632387FE8D76E3C0468',
  '043E8F663F4860EE12BF2D5B0B7474D6E694F91E6DBE115974A3926F12FEE5E4',
  '38777CB6A932DF8CD8BEC4D073B931BA3BC832B68D9DD300741FA7BF8AFC47ED',
  '2576F6936BA424663AAB639C5AE4F5683423B4742BF1C978238F16CBE39D652D',
  'E3FDB8BEFC848AD922222E04A4037C0713EB57A81A23F0C73473FC646CEA306B',
  '4BCBC8862F8385DDFA9D4B7FA2C087E879683303ED5BDD3A062B3CF5B3A278A6',
  '6D2A13F83F44F82DDF310EE074AB6A364597E899A0255DC164F31CC50846851D',
  'F9AB48195DED7EA1B1D510BD7EE74D73FAF36BC31ECFA268359046F4EB879F92',
  '4009438B481C6CD7889A002ED5EE382BC9190DA6FC026E479558E4475677E9AA',
  '9E3050E2765694DFC81F56E880B96E7160C980DD98EDD3DFFFFFFFFFFFFFFFFF',
].join(''));
const N = SRP_N;
const G = 19n;
const PAD = 1024; // 8192 bits
const pad = (n: bigint) => bigToBytes(n, PAD);
const sha1Big = (...parts: Uint8Array[]) => bytesToBig(sha1(concat(...parts)));

export class SrpServer {
  readonly salt: Uint8Array;
  readonly publicB: bigint;
  private readonly b: bigint;
  private readonly v: bigint;

  constructor(password: string, opts: { salt?: Uint8Array; secretB?: bigint } = {}) {
    this.salt = opts.salt ?? randomBytes(16);
    const x = sha1Big(this.salt, sha1(utf8(`user:${password}`)));
    this.v = modPow(G, x, N);
    const k = sha1Big(pad(N), pad(G));
    this.b = (opts.secretB ?? bytesToBig(randomBytes(32))) % N;
    this.publicB = (k * this.v + modPow(G, this.b, N)) % N;
  }

  get saltB64() { return toB64(this.salt); }
  get publicB64() { return toB64(bigToBytes(this.publicB)); }

  /** Shared secret S (minimal big-endian bytes) from the oven's public A. */
  secret(publicA64: string): Uint8Array {
    const A = bytesToBig(fromB64(publicA64));
    if (A % N === 0n) throw new Error('Invalid SRP public value from oven');
    const u = sha1Big(pad(A), pad(this.publicB));
    return bigToBytes(modPow((A * modPow(this.v, u, N)) % N, this.b, N));
  }
}

/** Session key K = BLAKE2b-256(S). */
export const sessionKey = (secret: Uint8Array) => blake2b(secret, { dkLen: 32 });

/** NaCl secretbox, nonce prepended, base64 — the June `*_info` sealing. */
export function seal(json: unknown, key: Uint8Array): string {
  const nonce = randomBytes(24);
  const box = xsalsa20poly1305(key, nonce).encrypt(utf8(JSON.stringify(json)));
  return toB64(concat(nonce, box));
}

export function open<T = unknown>(sealed64: string, key: Uint8Array): T {
  const raw = fromB64(sealed64);
  const plain = xsalsa20poly1305(key, raw.subarray(0, 24)).decrypt(raw.subarray(24));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

// --- keys --------------------------------------------------------------------

export type CompanionKeys = { signSeedHex: string; signPublic64: string; boxSecretHex: string; boxPublic64: string };

export function generateKeys(): CompanionKeys {
  const sign = ed25519.keygen();
  const box = x25519.keygen();
  return {
    signSeedHex: toHex(sign.secretKey),
    signPublic64: toB64(sign.publicKey),
    boxSecretHex: toHex(box.secretKey),
    boxPublic64: toB64(box.publicKey),
  };
}

export const randomHex = (bytes: number) => toHex(randomBytes(bytes));

// --- signed frames -----------------------------------------------------------

export type Identity = { deviceId: string; deviceName: string; ovenId: string; signSeedHex: string };

export class OrderGenerator {
  private last = 0;
  next(nowMs = Date.now()): number {
    let order = nowMs & 0x7fffffff;
    if (order <= this.last) order = this.last + 1;
    this.last = order;
    return order;
  }
}

/**
 * Compact JSON in the exact key order the June app's Gson emits; the oven
 * verifies the Ed25519 signature over these bytes with `signature` = "".
 */
export function buildSignedFrame(id: Identity, code: number, data: Record<string, unknown>, order: number, nowMs = Date.now()): string {
  const msg = {
    v: 2, message_code: code, order, time: nowMs, signature: '',
    device_name: id.deviceName, device_id: id.deviceId, data, target: { id: id.ovenId },
  };
  const seed = fromHex(id.signSeedHex);
  const sig = ed25519.sign(utf8(JSON.stringify(msg)), seed);
  const fp = blake2b(ed25519.getPublicKey(seed), { dkLen: 8 });
  msg.signature = toB64(concat(fp, sig));
  return JSON.stringify(msg);
}

// --- units -------------------------------------------------------------------

export const fToMilliC = (f: number) => Math.round(((f - 32) * 5) / 9 * 1000);
export const cToMilliC = (c: number) => Math.round(c * 1000);
export const milliCToF = (m: number) => (m / 1000) * 9 / 5 + 32;
export const milliCToC = (m: number) => m / 1000;

/** The oven's long SRP public A, wherever it sits in a 10026 payload. */
export function findPublicA(data: unknown): string | null {
  const ka = (data as { key_info?: { A?: unknown } })?.key_info?.A;
  if (typeof ka === 'string') return ka;
  const m = JSON.stringify(data ?? null).match(/"([A-Za-z0-9+/=]{300,})"/);
  return m ? m[1] : null;
}

export { dammCheck };
