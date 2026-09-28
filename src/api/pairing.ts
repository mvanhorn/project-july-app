// One PIN pairing session. Mirrors JunePairingSession in ha-june-oven/api.py:
// register → open socket → mint code → oven sends SRP A (10026) → we post
// B, salt and sealed companion_info → oven sends sealed oven_info (10026).
import type { Connection } from './endpoint';
import { MC, SrpServer, findPublicA, generateKeys, open, randomHex, seal, sessionKey, APP_VERSION, CLIENT_ID, CLIENT_SECRET, PLATFORM_VERSION } from './protocol';
import { buildPairingCode } from './pairingCode';
import { OvenError, openSocket, rest, type Paired } from './client';

export type PairingStep =
  | { step: 'starting' }
  | { step: 'show-code'; code: string; expiresAt: number }
  | { step: 'exchanging'; code: string }
  | { step: 'paired'; paired: Paired }
  | { step: 'failed'; message: string };

type Json = Record<string, any>;
type OvenInfo = { oven_id: string; oven_name?: string; model_number?: string; version?: string; serial_number?: string; public_signing_key?: string };

export class PairingSession {
  private ws: WebSocket | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private closed = false;
  private reg!: { deviceId: string; password: string; accessToken: string; refreshToken: string };
  private serverCode = '';
  private shown = '';
  private srp: SrpServer | null = null;
  private key: Uint8Array | null = null;
  private keys = generateKeys();
  private exchanging = false;
  private associatedOvenId: string | null = null;

  constructor(private conn: Connection, private deviceName: string, private onStep: (s: PairingStep) => void) {}

  async begin() {
    this.onStep({ step: 'starting' });
    try {
      await this.register();
      await this.openSocket();
      const res = await rest<Json>(this.conn, 'POST', '/2/devices/pairing', { token: this.reg.accessToken });
      const code = res.pin?.code;
      if (typeof code !== 'string' || !/^\d{5}$/.test(code)) throw new OvenError('The oven server sent an unexpected pairing code.');
      this.serverCode = code;
      this.shown = buildPairingCode(code);
      // 8192-bit modular exponentiation; yield a frame so the UI can paint first.
      await new Promise((r) => setTimeout(r, 16));
      this.srp = new SrpServer(this.shown);
      const expiresSec = typeof res.pin?.expires === 'number' ? res.pin.expires : 0;
      const expiresAt = expiresSec > Date.now() / 1000 ? expiresSec * 1000 : Date.now() + 5 * 60_000;
      this.after(expiresAt - Date.now(), () => this.fail('The code expired before the oven used it. Get a new code and enter it straight away.'));
      this.onStep({ step: 'show-code', code: this.shown, expiresAt });
    } catch (e) {
      this.fail((e as Error).message);
    }
  }

  close() {
    this.closed = true;
    this.timers.forEach(clearTimeout);
    this.ws?.close();
    this.ws = null;
  }

  private after(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, Math.max(0, ms)));
  }

  private fail(message: string) {
    if (this.closed) return;
    this.close();
    this.onStep({ step: 'failed', message });
  }

  private async register() {
    const deviceId = randomHex(16);
    const password = randomHex(16);
    const res = await rest<Json>(this.conn, 'POST', '/2/devices/register', {
      body: {
        password, device_id: deviceId, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        device_type: 'companion', device_name: this.deviceName, platform: 'android',
        version: APP_VERSION, platform_version: PLATFORM_VERSION,
      },
    });
    const token = res.token ?? res;
    if (typeof token?.access_token !== 'string') throw new OvenError('The oven server did not accept this phone.');
    this.reg = { deviceId, password, accessToken: token.access_token, refreshToken: String(token.refresh_token ?? '') };
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = openSocket(this.conn, this.reg.accessToken);
      this.ws = ws;
      const t = setTimeout(() => reject(new OvenError("Couldn't open a connection to the oven.")), 8000);
      ws.onopen = () => { clearTimeout(t); resolve(); };
      ws.onerror = () => { clearTimeout(t); reject(new OvenError("Couldn't open a connection to the oven.")); };
      ws.onclose = () => { if (!this.closed) this.fail('The connection to the oven dropped during pairing. Try again.'); };
      ws.onmessage = (ev) => { if (typeof ev.data === 'string') this.onFrame(ev.data); };
    });
  }

  private onFrame(raw: string) {
    let f: Json;
    try { f = JSON.parse(raw); } catch { return; }
    if (f.message_code === MC.PairingInvalidated) {
      this.fail('The oven cancelled pairing. Make sure it is idle with the door closed, then try again.');
      return;
    }
    if (f.message_code !== MC.PairingInfo) return;
    const sealedOven = f.data?.key_info?.oven_info;
    if (typeof sealedOven === 'string' && this.key) { this.finishWith(sealedOven); return; }
    const A = findPublicA(f.data);
    if (A && !this.exchanging) this.exchange(A);
  }

  private async exchange(publicA: string) {
    if (!this.srp) return;
    this.exchanging = true;
    this.onStep({ step: 'exchanging', code: this.shown });
    try {
      await new Promise((r) => setTimeout(r, 16));
      this.key = sessionKey(this.srp.secret(publicA));
      const companionInfo = {
        companion_id: this.reg.deviceId,
        companion_name: this.deviceName,
        public_signing_key: this.keys.signPublic64,
        public_encryption_key: this.keys.boxPublic64,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        platform: 'Android',
      };
      const res = await rest<Json>(this.conn, 'POST', `/2/devices/pairing/${this.serverCode}/companion`, {
        token: this.reg.accessToken,
        body: { key_info: { salt: this.srp.saltB64, B: this.srp.publicB64, companion_info: seal(companionInfo, this.key) } },
      });
      const sealedOven = res.key_info?.oven_info;
      if (typeof sealedOven === 'string') { this.finishWith(sealedOven); return; }
      this.pollAssociation(0);
    } catch (e) {
      this.fail((e as Error).message);
    }
  }

  /** Fallback when sealed oven_info doesn't arrive: the association list names the oven. */
  private pollAssociation(attempt: number) {
    this.after(attempt === 0 ? 3000 : 2500, async () => {
      if (this.closed) return;
      try {
        const res = await rest<Json>(this.conn, 'GET', `/2/devices/${this.reg.deviceId}/associated`, { token: this.reg.accessToken });
        const oven = (res.devices ?? []).find((d: Json) => typeof d?.oven_id === 'string');
        if (oven) this.associatedOvenId = oven.oven_id;
      } catch {}
      // Give the sealed oven_info a few more seconds before settling for the association.
      if (this.associatedOvenId && attempt >= 3) {
        this.done({ oven_id: this.associatedOvenId, oven_name: 'June Oven' });
      } else if (attempt < 40) {
        this.pollAssociation(attempt + 1);
      } else {
        this.fail("The oven didn't finish pairing. Start again from the oven's Connect screen.");
      }
    });
  }

  private finishWith(sealedOven: string) {
    try {
      this.done(open<OvenInfo>(sealedOven, this.key!));
    } catch {
      this.fail("The oven's reply didn't match this code. Check the eight digits and try again.");
    }
  }

  private done(info: OvenInfo) {
    if (this.closed) return;
    // Delete the mailbox only now; deleting earlier makes the oven send 10027.
    rest(this.conn, 'DELETE', `/2/devices/pairing/${this.serverCode}/companion`, { token: this.reg.accessToken }).catch(() => {});
    const paired: Paired = {
      conn: this.conn,
      deviceId: this.reg.deviceId,
      deviceName: this.deviceName,
      password: this.reg.password,
      accessToken: this.reg.accessToken,
      refreshToken: this.reg.refreshToken,
      keys: this.keys,
      oven: {
        id: info.oven_id,
        name: info.oven_name && info.oven_name !== 'June Oven' ? info.oven_name : 'Kitchen oven',
        model: info.model_number, serial: info.serial_number, version: info.version,
        publicSigningKey: info.public_signing_key,
      },
      pairedAt: Date.now(),
    };
    this.close();
    this.onStep({ step: 'paired', paired });
  }
}
