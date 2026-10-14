// june-local's live camera stream, GET /media/stream.mjpg (golocal/rest.go,
// serveMJPEG): multipart/x-mixed-replace, one part per new JPEG, written as
//
//   --frame\r\nContent-Type: image/jpeg\r\nContent-Length: N\r\n\r\n<N bytes>\r\n
//
// Neither image library under expo-image plays MJPEG, so the app reads the
// stream with fetch (expo/fetch streams response bodies on iOS and Android)
// and shows each JPEG as it arrives. An open stream also counts as a viewer:
// june-local keeps the camera (and the interior light) on while it is open and
// lets them lapse about 15 s after it closes.
//
// On iOS the stream doesn't arrive as written. URLSession (under expo/fetch)
// takes multipart/x-mixed-replace apart itself: it hands over the JPEGs back to
// back, with the boundaries and part headers gone, and the response may carry
// the first part's image/jpeg type instead of the multipart one. So the parser
// also splits bare JPEGs, by walking their markers to the end of each picture.

const enc = new TextEncoder();
const dec = new TextDecoder();
const HEADER_END = enc.encode('\r\n\r\n');
const SOI = Uint8Array.of(0xff, 0xd8);
const MAX_BUFFER = 12 << 20; // june-local refuses frames over 10 MiB

function indexOf(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  const last = hay.length - needle.length;
  outer: for (let i = from; i <= last; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/**
 * Where the JPEG starting at `at` ends (just past its EOI marker), or -1 if it
 * isn't all here yet. Segments are skipped by their length, so an EXIF thumbnail
 * (a whole JPEG inside APP1) doesn't end the picture early.
 */
export function jpegEnd(b: Uint8Array, at: number): number {
  let i = at + 2;
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) { i++; continue; } // scan data
    const m = b[i + 1];
    if (m === 0xd9) return i + 2;
    if (m === 0xff) { i++; continue; } // fill byte
    // A stuffed FF 00 in scan data, a restart marker, or another marker without a length.
    if (m === 0x00 || m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += 2; continue; }
    if (i + 3 >= b.length) return -1;
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return -1;
}

/** The boundary named in a multipart Content-Type, without the leading dashes. */
export function boundaryOf(contentType: string | null): string | null {
  const m = contentType?.match(/^\s*multipart\/x-mixed-replace\s*;.*?boundary="?([^";]+)"?/i);
  return m ? m[1].replace(/^--/, '') : null;
}

/**
 * Splits a multipart/x-mixed-replace byte stream into its JPEG parts. Also takes
 * JPEGs back to back with no multipart around them (iOS), with or without a boundary.
 */
export class MjpegParser {
  private buf = new Uint8Array(0);
  private need: number | null = null; // body bytes still to read for the current part
  private inBody = false;
  private readonly marker: Uint8Array | null;
  private readonly tail: Uint8Array | null;

  constructor(boundary: string | null) {
    this.marker = boundary === null ? null : enc.encode(`--${boundary}`);
    this.tail = boundary === null ? null : enc.encode(`\r\n--${boundary}`);
  }

  push(chunk: Uint8Array): Uint8Array[] {
    const joined = new Uint8Array(this.buf.length + chunk.length);
    joined.set(this.buf);
    joined.set(chunk, this.buf.length);
    this.buf = joined;
    const frames: Uint8Array[] = [];
    for (;;) {
      if (!this.inBody) {
        // A boundary always comes before its part's picture, so a picture that
        // comes first has no multipart around it.
        const start = this.marker ? indexOf(this.buf, this.marker) : -1;
        const soi = indexOf(this.buf, SOI);
        if (soi >= 0 && (start < 0 || soi < start)) {
          const end = jpegEnd(this.buf, soi);
          if (end < 0) break;
          frames.push(this.buf.slice(soi, end));
          this.buf = this.buf.slice(end);
          continue;
        }
        if (start < 0 || !this.marker) break;
        const end = indexOf(this.buf, HEADER_END, start + this.marker.length);
        if (end < 0) break;
        const headers = dec.decode(this.buf.subarray(start + this.marker.length, end));
        const len = headers.match(/content-length:\s*(\d+)/i);
        this.need = len ? Number(len[1]) : null;
        this.buf = this.buf.slice(end + HEADER_END.length);
        this.inBody = true;
      }
      if (this.need !== null) {
        if (this.buf.length < this.need) break;
        frames.push(this.buf.slice(0, this.need));
        this.buf = this.buf.slice(this.need);
      } else {
        // No Content-Length: the part runs up to the next boundary.
        const next = indexOf(this.buf, this.tail!);
        if (next < 0) break;
        frames.push(this.buf.slice(0, next));
        this.buf = this.buf.slice(next + 2);
      }
      this.inBody = false;
      this.need = null;
    }
    if (this.buf.length > MAX_BUFFER) {
      // Lost sync (or a broken server): drop what we have and wait for the next boundary.
      this.buf = new Uint8Array(0);
      this.inBody = false;
      this.need = null;
    }
    return frames.filter((f) => f.length >= 2 && f[0] === 0xff && f[1] === 0xd8);
  }
}

export class NotAStreamError extends Error {}

/**
 * Read an MJPEG stream until it ends or `signal` aborts, calling `onFrame` with
 * each JPEG. Resolves when the server closes the stream; rejects on network
 * errors, on an abort, and with NotAStreamError when the URL answers with
 * something other than a stream (an older june-local without /media/stream.mjpg).
 * An image/jpeg answer counts as a stream: that's how iOS reports it.
 */
export async function readMjpeg(
  url: string,
  opts: { headers?: Record<string, string>; signal: AbortSignal; onFrame: (jpeg: Uint8Array) => void },
): Promise<void> {
  const res = await fetch(url, { headers: opts.headers, signal: opts.signal });
  const type = res.headers.get('content-type');
  const boundary = boundaryOf(type);
  if (!res.ok || !(boundary || /^\s*image\/jpeg\b/i.test(type ?? '')) || !res.body) {
    res.body?.cancel().catch(() => {});
    throw new NotAStreamError(`No camera stream (HTTP ${res.status})`);
  }
  const parser = new MjpegParser(boundary);
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      for (const frame of parser.push(value)) opts.onFrame(frame);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
