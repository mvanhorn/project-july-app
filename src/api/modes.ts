// Cook modes the phone can start with 11002 Preheat (`primitive_type`).
// Temperatures in °F; the wire takes milli-°C.

export type CookMode = { id: string; label: string; hint: string; defaultF: number; minF: number; maxF: number };

export const MODES: CookMode[] = [
  { id: 'bake', label: 'Bake', hint: 'Cakes, casseroles, most everyday cooking', defaultF: 350, minF: 170, maxF: 450 },
  { id: 'roast', label: 'Roast', hint: 'Vegetables and meats, browned outside', defaultF: 400, minF: 250, maxF: 450 },
  { id: 'airfry', label: 'Air fry', hint: 'Crisp without the oil', defaultF: 400, minF: 300, maxF: 450 },
  { id: 'broil', label: 'Broil', hint: 'Top heat to melt and brown', defaultF: 450, minF: 400, maxF: 450 },
  { id: 'pizzaiolo', label: 'Pizza', hint: 'Hottest oven for a crisp base', defaultF: 450, minF: 400, maxF: 450 },
  { id: 'reheat', label: 'Reheat', hint: 'Warm up leftovers gently', defaultF: 300, minF: 250, maxF: 400 },
  { id: 'warm', label: 'Keep warm', hint: 'Hold cooked food until serving', defaultF: 170, minF: 150, maxF: 200 },
  { id: 'dehydrate', label: 'Dehydrate', hint: 'Dry fruit, herbs and jerky', defaultF: 150, minF: 100, maxF: 200 },
  { id: 'proof', label: 'Proof', hint: 'Help dough rise', defaultF: 90, minF: 80, maxF: 110 },
  { id: 'slow_cook', label: 'Slow cook', hint: 'Low and slow for hours', defaultF: 225, minF: 180, maxF: 275 },
];

/**
 * Idle tiles on the glass home screen. The Home Assistant card offers bake, roast,
 * broil, air fry and toast; toast is not in MODES here (a refused temperature change
 * must never restart it, see scripts/client.test.ts), so pizza takes its place.
 */
export const QUICK_MODES = ['bake', 'roast', 'broil', 'airfry', 'pizzaiolo'];

export function modeLabel(id: string | null | undefined): string {
  if (!id) return 'Cooking';
  const m = MODES.find((x) => x.id === id || id.startsWith(x.id));
  if (m) return m.label;
  return id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const cToF = (c: number) => (c * 9) / 5 + 32;

export type Unit = 'F' | 'C';

/** A °C reading shown in the chosen unit, rounded for display. */
export function show(c: number | null, unit: Unit): string {
  if (c === null) return '—';
  return String(Math.round(unit === 'F' ? cToF(c) : c));
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
