// Eight-digit pairing code: server_code(5) + random(2) + Damm check(1).
// See apps/project-july-operator-pack/pairing-code.md.

const DAMM = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

export function dammCheck(digits: string): number {
  let interim = 0;
  for (const ch of digits) {
    const d = ch.charCodeAt(0) - 48;
    if (d < 0 || d > 9) throw new Error(`not a digit: ${ch}`);
    interim = DAMM[interim][d];
  }
  return interim;
}

export function isValidPairingCode(code: string): boolean {
  return /^\d{8}$/.test(code) && dammCheck(code) === 0;
}

/** Build the display code from the server's five-digit `pin.code`. */
export function buildPairingCode(serverCode: string, random2?: string): string {
  if (!/^\d{5}$/.test(serverCode)) throw new Error('server code must be five digits');
  const r = random2 ?? String(Math.floor(Math.random() * 100)).padStart(2, '0');
  const seven = serverCode + r;
  return seven + dammCheck(seven);
}

/** "12345678" → "1234 5678" for display. */
export function formatPairingCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}
