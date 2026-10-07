// The network search against a simulated home network, with an HTTP client that
// behaves like Android's (OkHttp): 64 requests at once, the rest queued, and each
// request's timeout running from the moment it is asked for, queued or not.
// Addresses without a device never answer; the oven answers on port 80 only.
import assert from 'node:assert/strict';
import { sweep, type Check } from '../src/api/scan';
import type { LocalStatus } from '../src/api/endpoint';

const OVEN = '192.168.1.207';
const STATUS: LocalStatus = { ok: true, mode: 'local', server: 'june-local', version: 'local' };
const TIMEOUT = 60; // ms, scaled down from the app's 2000 so the test runs quickly

function okhttpLike(maxInFlight = 64) {
  let inFlight = 0;
  let peak = 0;
  let queued = 0;
  const queue: (() => void)[] = [];
  const check: Check = (host, port, timeoutMs) => new Promise((resolve) => {
    let finished = false;
    const finish = (v: LocalStatus | null) => {
      if (finished) return;
      finished = true;
      resolve(v);
    };
    // The caller's timeout starts now, whether or not the request is sent yet.
    setTimeout(() => finish(null), timeoutMs);
    const send = () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      const release = () => { inFlight--; queue.shift()?.(); };
      if (finished) { release(); return; }
      if (host === OVEN && port === 80) setTimeout(() => { finish(STATUS); release(); }, 5);
      // No device there: the connection hangs until the caller gives up.
      else setTimeout(release, timeoutMs);
    };
    if (inFlight < maxInFlight) send(); else { queued++; queue.push(send); }
  });
  return { check, peak: () => peak, queued: () => queued };
}

async function main() {
  {
    const net = okhttpLike();
    const found = await sweep('192.168.1', [80, 8080], net.check, { parallel: 40, timeoutMs: TIMEOUT });
    assert.deepEqual(found.map((f) => [f.host, f.httpPort]), [[OVEN, 80]]);
    // A timed-out request's slot frees a moment after the next one starts, so the peak can
    // pass 40 briefly; what matters is that nothing ever waits in the client's queue.
    assert.equal(net.queued(), 0, `no request queued (peak ${net.peak()} in flight)`);
    console.log('✓ finds the oven on port 80, never queueing behind Android\'s 64-request limit');
  }
  {
    // What the first search did: both ports for 48 addresses at once (96 requests).
    const net = okhttpLike();
    let hit = false;
    const hosts = Array.from({ length: 254 }, (_, i) => `192.168.1.${i + 1}`);
    let next = 0;
    const worker = async () => {
      while (next < hosts.length) {
        const host = hosts[next++];
        const r = await Promise.all([80, 8080].map((p) => net.check(host, p, TIMEOUT)));
        if (r.some(Boolean)) hit = true;
      }
    };
    await Promise.all(Array.from({ length: 48 }, worker));
    assert.ok(net.queued() > 0, 'the old pattern overfills the client');
    console.log(`✓ the old pattern queued ${net.queued()} requests behind the 64 limit and ${hit ? 'still' : 'never'} found the oven`);
  }
  {
    const net = okhttpLike();
    const stop = new AbortController();
    const seen: string[] = [];
    const run = sweep('192.168.1', [80, 8080], net.check, {
      parallel: 40, timeoutMs: TIMEOUT, signal: stop.signal, onProgress: () => { if (seen.length === 0) stop.abort(); seen.push('x'); },
    });
    assert.deepEqual(await run, []);
    console.log('✓ stops when the setup screen closes');
  }
  console.log('all discover checks passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
