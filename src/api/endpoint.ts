// One configured endpoint (the oven's LAN address) derives every URL.
//
// june-local serves the same routes on both listeners, so a phone that cannot
// trust the home certificate can fall back to the plain listener. That is port 80
// on the oven (its init script runs `--http-port 80`) and 8080 on the reference
// server, so setup tries both and remembers which answered. Commands stay
// Ed25519-signed and pairing stays SRP-protected either way.

export type Connection = {
  host: string;
  secure: boolean;
  /** The plain listener's port. Pairings made before it was recorded used 8080. */
  httpPort?: number;
};

/** Where june-local's plain listener can be: the oven, then the reference server. */
export const PLAIN_PORTS = [80, 8080];

export function normalizeHost(input: string): string {
  return input.trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').replace(/:(443|80|8080)$/, '');
}

const plainBase = (bare: string, port = 8080) => (port === 80 ? `http://${bare}` : `http://${bare}:${port}`);

export function urls({ host, secure, httpPort }: Connection) {
  const bare = host.replace(/:\d+$/, '');
  const plain = plainBase(bare, httpPort);
  const base = secure ? `https://${host}` : plain;
  return {
    base,
    ws: `${secure ? `wss://${host}` : plain.replace(/^http/, 'ws')}/1/messaging/websocket/companion`,
    statusPage: `${plain}/local`,
    latestImage: `${base}/media/prod/images/latest.jpg`,
    stream: `${base}/media/stream.mjpg`,
  };
}

/** Re-home a camera URL from a 10011 frame (it names api.junelife.com) onto our endpoint. */
export function rehomeMediaUrl(conn: Connection, imageUrl: string): string {
  const m = imageUrl.match(/^[a-z]+:\/\/[^/]+(\/.*)$/i);
  return m ? urls(conn).base + m[1] : imageUrl;
}

export type LocalStatus = { ok: boolean; mode: string; server: string; version: string };

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fn(ctl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** june-local's status from a base URL, or null if nothing (or something else) answers. */
export async function localStatus(base: string, ms = 5000): Promise<LocalStatus | 'other' | null> {
  try {
    return await withTimeout(ms, async (signal) => {
      const res = await fetch(`${base}/local/status`, { signal });
      const status = (await res.json()) as LocalStatus;
      return status?.server === 'june-local' ? status : 'other';
    });
  } catch {
    return null;
  }
}

export type ProbeResult =
  | { ok: true; secure: boolean; httpPort: number | undefined; status: LocalStatus }
  | { ok: false; reason: 'unreachable' | 'not-july'; message: string };

/**
 * Find how this phone can reach the server: HTTPS first, then the plain listener
 * (port 80 or 8080). If only the plain one answers, the home certificate isn't
 * trusted yet.
 */
export async function probe(host: string): Promise<ProbeResult> {
  const bare = host.replace(/:\d+$/, '');
  const [https, ...plain] = await Promise.all([
    localStatus(`https://${host}`),
    ...PLAIN_PORTS.map((port) => localStatus(plainBase(bare, port))),
  ]);
  const at = plain.findIndex((s) => s !== null && s !== 'other');
  const httpPort = at >= 0 ? PLAIN_PORTS[at] : undefined;
  if (https && https !== 'other') return { ok: true, secure: true, httpPort, status: https };
  if (at >= 0) return { ok: true, secure: false, httpPort, status: plain[at] as LocalStatus };
  if (https === 'other' || plain.includes('other')) {
    return { ok: false, reason: 'not-july', message: 'Something answered at that address, but it is not a june-local server.' };
  }
  return {
    ok: false,
    reason: 'unreachable',
    message: 'No answer from that address. Check the phone is on the same Wi-Fi as the oven, and that the oven is switched on.',
  };
}

/** The address of a june-local server: plain HTTP on either port, used by the network scan. */
export async function findJuneLocal(ip: string, ms: number): Promise<{ httpPort: number; status: LocalStatus } | null> {
  const found = await Promise.all(PLAIN_PORTS.map((port) => localStatus(plainBase(ip, port), ms)));
  const at = found.findIndex((s) => s !== null && s !== 'other');
  return at >= 0 ? { httpPort: PLAIN_PORTS[at], status: found[at] as LocalStatus } : null;
}
