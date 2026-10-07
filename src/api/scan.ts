// The network search's loop, kept free of React Native so scripts/discover.test.ts
// can run it against a simulated network (see discover.ts for the phone side).
//
// Android's HTTP client (OkHttp) runs at most 64 requests at once and queues the
// rest, and a queued request's timeout runs while it waits. The first search asked
// 48 addresses on two ports at once (96 requests): requests to addresses with no
// device held their slot for the whole timeout, and the oven's own request could
// time out in the queue before it was sent. So: one port at a time (the oven's
// first), with fewer requests in flight than the client allows.
import type { LocalStatus } from './endpoint';

export type Found = { host: string; httpPort: number; status: LocalStatus };

/** Ask one address on one port for june-local's status; null if nothing answers in time. */
export type Check = (host: string, port: number, timeoutMs: number) => Promise<LocalStatus | null>;

export type SweepOptions = {
  /** Requests in flight at once. Keep it under OkHttp's 64. */
  parallel: number;
  timeoutMs: number;
  onProgress?: (done: number, total: number, port: number) => void;
  onFound?: (f: Found) => void;
  signal?: AbortSignal;
};

/** Every address on `prefix`.0/24, one port at a time; later ports only if nothing answered. */
export async function sweep(prefix: string, ports: number[], check: Check, opts: SweepOptions): Promise<Found[]> {
  const total = 254;
  const found: Found[] = [];
  for (const port of ports) {
    if (found.length || opts.signal?.aborted) break;
    let next = 1;
    let done = 0;
    const worker = async () => {
      while (next <= total && !opts.signal?.aborted) {
        const host = `${prefix}.${next++}`;
        const status = await check(host, port, opts.timeoutMs);
        if (opts.signal?.aborted) return;
        opts.onProgress?.(++done, total, port);
        if (status) {
          const f = { host, httpPort: port, status };
          found.push(f);
          opts.onFound?.(f);
        }
      }
    };
    await Promise.all(Array.from({ length: opts.parallel }, worker));
  }
  return found;
}
