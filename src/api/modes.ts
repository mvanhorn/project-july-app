// Cook modes the phone can start with 11002 Preheat (`primitive_type`).
// Temperatures in °F; the wire takes milli-°C.

export type CookMode = {
  id: string; label: string; hint: string; defaultF: number; minF: number; maxF: number;
  /**
   * Not yet started from a phone. Bake is proven on a real oven, and roast, broil
   * and airfry are names the Home Assistant integration sends ("names match the June
   * app"). The rest are guesses, or likely programs: proof runs as a touchscreen
   * program (plan 114), which may not start by name, and toast may be one too.
   * The oven may refuse these; the app then says so and nothing starts.
   */
  untested?: boolean;
  /**
   * Never cancel and restart at a new temperature when the oven refuses a change
   * (setTemperature): toast is likely a timed program rather than held at a
   * temperature, so a refused change leaves it running (scripts/client.test.ts).
   */
  noRestart?: boolean;
};

export const MODES: CookMode[] = [
  { id: 'bake', label: 'Bake', hint: 'Cakes, casseroles, most everyday cooking', defaultF: 350, minF: 170, maxF: 450 },
  { id: 'roast', label: 'Roast', hint: 'Vegetables and meats, browned outside', defaultF: 400, minF: 250, maxF: 450 },
  { id: 'airfry', label: 'Air fry', hint: 'Crisp without the oil', defaultF: 400, minF: 300, maxF: 450 },
  { id: 'broil', label: 'Broil', hint: 'Top heat to melt and brown', defaultF: 450, minF: 400, maxF: 450 },
  // The integration sends "toast" by name, but on the oven Toast is likely a
  // program (like proof), so it may not start that way.
  { id: 'toast', label: 'Toast', hint: 'Bread, bagels and English muffins', defaultF: 450, minF: 300, maxF: 500, noRestart: true, untested: true },
  { id: 'pizzaiolo', label: 'Pizza', hint: 'Hottest oven for a crisp base', defaultF: 450, minF: 400, maxF: 450, untested: true },
  { id: 'reheat', label: 'Reheat', hint: 'Warm up leftovers gently', defaultF: 300, minF: 250, maxF: 400, untested: true },
  { id: 'warm', label: 'Keep warm', hint: 'Hold cooked food until serving', defaultF: 170, minF: 150, maxF: 200, untested: true },
  { id: 'dehydrate', label: 'Dehydrate', hint: 'Dry fruit, herbs and jerky', defaultF: 150, minF: 100, maxF: 200, untested: true },
  { id: 'proof', label: 'Proof', hint: 'Help dough rise', defaultF: 90, minF: 80, maxF: 110, untested: true },
  { id: 'slow_cook', label: 'Slow cook', hint: 'Low and slow for hours', defaultF: 225, minF: 180, maxF: 275, untested: true },
];

/**
 * Mode tiles on the glass home screen, in the oven's order: the Home Assistant card's
 * five (bake, roast, broil, air fry, toast) first, then the other untested ones.
 * By default they are paged, as on the card: the first TOP_MODES with Camera and
 * Settings (the card's 4 × 2), then the rest, eight to a page.
 */
export const TOP_MODES = 6;
export const TILE_MODES = ['bake', 'roast', 'broil', 'airfry', 'toast', 'pizzaiolo', 'reheat', 'warm', 'dehydrate', 'proof', 'slow_cook']
  .map((id) => MODES.find((m) => m.id === id)!);

/** The tiles' modes, most used first if asked (ties keep the oven's order), as on the card. */
export function tileModes(order: 'oven' | 'used', uses: Record<string, number>): CookMode[] {
  if (order !== 'used') return TILE_MODES;
  return TILE_MODES.map((m, i) => [m, i] as const)
    .sort((a, b) => (uses[b[0].id] ?? 0) - (uses[a[0].id] ?? 0) || a[1] - b[1])
    .map(([m]) => m);
}

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
