/// <reference types="node" />
// Run: npx tsx scripts/protocol.test.ts — vectors from ha-june-oven/tests/test_protocol.py
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { sha1 } from "@noble/hashes/legacy.js";
import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { SRP_N, sessionKey, toB64, toHex, SrpServer, buildSignedFrame, fToMilliC, fromB64, fromHex, generateKeys, seal, open, OrderGenerator } from '../src/api/protocol';
import { buildPairingCode, isValidPairingCode } from '../src/api/pairingCode';

assert.equal(fToMilliC(350), 176667);
assert.equal(buildPairingCode('12345', '67'), '12345671');
assert.ok(isValidPairingCode('12345671'));

const o = new OrderGenerator();
assert.deepEqual([o.next(1000), o.next(1000), o.next(999)], [1000, 1001, 1002]);

const t0 = Date.now();
const srp = new SrpServer('12345678', { salt: Uint8Array.from({ length: 16 }, (_, i) => i), secretB: 123456789n });
assert.equal(srp.saltB64, 'AAECAwQFBgcICQoLDA0ODw==');
assert.equal(createHash('sha256').update(srp.publicB64).digest('hex'), '5e52eddb66d2e5956848cff9c169f2ad7baf5d18ccf71aa990abef833f568f16');
console.log('SRP B matches python vector in', Date.now() - t0, 'ms');

const keys = generateKeys();
const frame = buildSignedFrame({ deviceId: 'companion', deviceName: 'Home Assistant', ovenId: 'oven', signSeedHex: keys.signSeedHex }, 11004, { plan_id: 0 }, 42, 1000);
const parsed = JSON.parse(frame);
assert.deepEqual(Object.keys(parsed), ['v', 'message_code', 'order', 'time', 'signature', 'device_name', 'device_id', 'data', 'target']);
const sig = fromB64(parsed.signature);
assert.equal(sig.length, 72);
const pub = ed25519.getPublicKey(fromHex(keys.signSeedHex));
assert.deepEqual(sig.subarray(0, 8), blake2b(pub, { dkLen: 8 }));
parsed.signature = '';
assert.ok(ed25519.verify(sig.subarray(8), new TextEncoder().encode(JSON.stringify(parsed)), pub));

const k = new Uint8Array(32).fill(7);
assert.deepEqual(open(seal({ a: 1 }, k), k), { a: 1 });
console.log('frame:', frame);
console.log('all protocol checks passed');


// Full handshake: play the oven (SRP client) and check both sides derive the same K.
{
  const L = 1024, g = 19n, N = SRP_N, pin = "12345671";
  const big = (b: Uint8Array) => BigInt("0x" + toHex(b));
  const enc = (n: bigint, len = 0) => {
    let h = n.toString(16); if (h.length % 2) h = "0" + h;
    const r = Uint8Array.from(h.match(/../g)!, (x) => parseInt(x, 16));
    const o = new Uint8Array(Math.max(len, r.length)); o.set(r, o.length - r.length); return o;
  };
  const cat = (...p: Uint8Array[]) => Uint8Array.from(p.flatMap((x) => Array.from(x)));
  const pow = (b: bigint, e: bigint, m: bigint) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
  const server = new SrpServer(pin);
  const a = 987654321987654321987654321n, A = pow(g, a, N), B = server.publicB;
  const u = big(sha1(cat(enc(A, L), enc(B, L))));
  const k = big(sha1(cat(enc(N, L), enc(g, L))));
  const x = big(sha1(cat(server.salt, sha1(new TextEncoder().encode("user:" + pin)))));
  const Sc = pow(((B - k * pow(g, x, N)) % N + N) % N, a + u * x, N);
  assert.equal(toHex(sessionKey(server.secret(toB64(enc(A))))), toHex(sessionKey(enc(Sc))));
  console.log("SRP handshake: companion and oven derive the same session key");
}
