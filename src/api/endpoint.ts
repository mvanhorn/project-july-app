// One configured endpoint (the oven's LAN address) derives every URL.
//
// june-local serves the same routes on both listeners, so a phone that cannot
// trust the home certificate can fall back to the plain :8080 listener. Commands
// stay Ed25519-signed and pairing stays SRP-protected either way.

export type Connection = { host: string; secure: boolean };

export function normalizeHost(input: string): string {
  return input.trim().replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').replace(/:(443|8080)$/, '');
}

export function urls({ host, secure }: Connection) {
  const bare = host.replace(/:\d+$/, '');
  const base = secure ? `https://${host}` : `http://${bare}:8080`;
  return {
    base,
    ws: `${secure ? 'wss' : 'ws'}://${secure ? host : `${bare}:8080`}/1/messaging/websocket/companion`,
    statusPage: `http://${bare}:8080/local`,
    latestImage: `${base}/media/prod/images/latest.jpg`,
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

export type ProbeResult =
  | { ok: true; secure: boolean; status: LocalStatus }
  | { ok: false; reason: 'unreachable' | 'not-july'; message: string };

/**
 * Find how this phone can reach the server: HTTPS first, then plain :8080.
 * If :8080 answers but HTTPS does not, the home certificate isn't trusted yet.
 */
export async function probe(host: string): Promise<ProbeResult> {
  const get = (conn: Connection) =>
    withTimeout(5000, async (signal) => {
      const res = await fetch(`${urls(conn).base}/local/status`, { signal });
      return (await res.json()) as LocalStatus;
    });

  try {
    const status = await get({ host, secure: true });
    if (status.server === 'june-local') return { ok: true, secure: true, status };
  } catch {}
  try {
    const status = await get({ host, secure: false });
    if (status.server !== 'june-local') {
      return { ok: false, reason: 'not-july', message: 'Something answered at that address, but it is not a june-local server.' };
    }
    return { ok: true, secure: false, status };
  } catch {
    return {
      ok: false,
      reason: 'unreachable',
      message: 'No answer from that address. Check the phone is on the same Wi-Fi as the oven, and that the oven is switched on.',
    };
  }
}
