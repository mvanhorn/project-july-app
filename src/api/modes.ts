// Cook modes the phone can start with 11002 Preheat (`primitive_type`).
// Temperatures in °F; the wire takes milli-°C. Plans and their temperatures follow
// the oven's catalogue (project-july installer, apk-patches/chef-cookmodes).

export type CookMode = {
  id: string; label: string; hint: string; defaultF: number; minF: number; maxF: number;
  /**
   * Never cancel and restart at a new temperature when the oven refuses a change
   * (setTemperature): a plan the oven times or heats itself (toast, grill, reheat)
   * is left running (scripts/client.test.ts).
   */
  noRestart?: boolean;
  /**
   * The oven's plans for this mode in 11002 `plan_index` order, picked in place of a
   * temperature; each runs at its own temperature, which the start carries. `choice`
   * shows them side by side (grill: High, Medium, Low), `level` as a 1-to-n level
   * with a slider (toast: 1 Light to 9 Dark).
   */
  plans?: { label: string; f: number }[];
  planPicker?: 'choice' | 'level';
  defaultPlan?: number;
  /**
   * A timed mode: the oven sets the temperature (minF = maxF) and the review's control
   * is a timer the cook always gets, in minutes (reheat, as the Home Assistant card).
   */
  timed?: { defaultMin: number; maxMin: number };
  /** The plan times itself (toast: 2.5 to 6.5 minutes by level), so the review offers no timer. */
  noTimer?: boolean;
};

const TOAST_LEVELS = Array.from({ length: 9 }, (_, i) => ({ label: String(i + 1), f: 500 }));

export const MODES: CookMode[] = [
  { id: 'bake', label: 'Bake', hint: 'Cakes, casseroles, most everyday cooking', defaultF: 350, minF: 170, maxF: 450 },
  { id: 'roast', label: 'Roast', hint: 'Vegetables and meats, browned outside', defaultF: 400, minF: 250, maxF: 450 },
  { id: 'airfry', label: 'Air fry', hint: 'Crisp without the oil', defaultF: 400, minF: 300, maxF: 450 },
  // Broil, Pizza and Keep warm run at their plan's own temperature (Home Assistant: FIXED_MODE_TEMPS_F).
  { id: 'broil', label: 'Broil', hint: 'Top heat to melt and brown', defaultF: 500, minF: 500, maxF: 500, noRestart: true },
  {
    // Level N is plan N - 1 at the 500 °F the plan runs at (Home Assistant: toast_level - 1).
    id: 'toast', label: 'Toast', hint: 'Bread, bagels and English muffins', defaultF: 500, minF: 500, maxF: 500, noRestart: true,
    plans: TOAST_LEVELS, planPicker: 'level', defaultPlan: 4, noTimer: true,
  },
  {
    id: 'grill', label: 'Grill', hint: 'Grill marks and a seared top', defaultF: 450, minF: 275, maxF: 450, noRestart: true,
    plans: [{ label: 'High', f: 450 }, { label: 'Medium', f: 400 }, { label: 'Low', f: 275 }], planPicker: 'choice', defaultPlan: 0,
  },
  { id: 'pizzaiolo', label: 'Pizza', hint: 'Hottest oven for a crisp base', defaultF: 500, minF: 500, maxF: 500, noRestart: true },
  {
    id: 'reheat', label: 'Reheat', hint: 'Warm up leftovers gently', defaultF: 350, minF: 350, maxF: 350, noRestart: true,
    timed: { defaultMin: 60, maxMin: 600 },
  },
  { id: 'warm', label: 'Keep warm', hint: 'Hold cooked food until serving', defaultF: 170, minF: 170, maxF: 170, noRestart: true },
  // Proof and Dehydrate: the Home Assistant integration's MODE_TEMP_RANGES_F.
  { id: 'dehydrate', label: 'Dehydrate', hint: 'Dry fruit, herbs and jerky', defaultF: 135, minF: 100, maxF: 160 },
  { id: 'proof', label: 'Proof', hint: 'Help dough rise', defaultF: 85, minF: 80, maxF: 110 },
];

/**
 * Mode tiles on the glass home screen, in the oven's order: the Home Assistant card's
 * five (bake, roast, broil, air fry, toast) first, then grill and the rest.
 * Camera follows; the card sizes the grid to the phone (GlassHero).
 */
export const TILE_MODES = ['bake', 'roast', 'broil', 'airfry', 'toast', 'grill', 'pizzaiolo', 'reheat', 'warm', 'dehydrate', 'proof']
  .map((id) => MODES.find((m) => m.id === id)!);

/** The tiles' modes, most used first if asked (ties keep the oven's order), as on the card. */
export function tileModes(order: 'oven' | 'used', uses: Record<string, number>): CookMode[] {
  if (order !== 'used') return TILE_MODES;
  return TILE_MODES.map((m, i) => [m, i] as const)
    .sort((a, b) => (uses[b[0].id] ?? 0) - (uses[a[0].id] ?? 0) || a[1] - b[1])
    .map(([m]) => m);
}

/** A plan of the mode, or its default when `plan` isn't one (a mode without plans: undefined). */
export function validPlan(mode: CookMode, plan: number | undefined): number | undefined {
  if (!mode.plans) return undefined;
  return plan !== undefined && Number.isInteger(plan) && plan >= 0 && plan < mode.plans.length ? plan : mode.defaultPlan ?? 0;
}

/** A cook in a few words: "Toast 6", "Grill High", "Bake 350 °F". */
export function cookSummary(modeId: string, tempF: number, plan: number | undefined, unit: Unit): string {
  const m = MODES.find((x) => x.id === modeId);
  // As Repeat will start it: an older saved cook has no plan, or a temperature the mode no longer takes.
  if (m?.plans) return `${m.label} ${m.plans[validPlan(m, plan)!].label}`;
  const f = m && isFixed(m) ? m.minF : tempF;
  return `${modeLabel(modeId)} ${unit === 'F' ? f : Math.round(fToC(f))} °${unit}`;
}

/** The oven sets the temperature (broil, pizza, keep warm, reheat, toast). */
export const isFixed = (m: CookMode) => m.minF === m.maxF;

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
