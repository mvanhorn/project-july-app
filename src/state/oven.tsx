import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { LiveOven, emptySnapshot, type OvenLink, type OvenSnapshot, type Paired } from '@/api/client';
import { DEMO_SCENES, DemoOven } from '@/api/demo';
import type { Connection } from '@/api/endpoint';
import type { Unit } from '@/api/modes';
import { applyTrust, hasTrust, type Trust } from '@/api/trust';
import { load, remove, save } from './storage';

const PAIRED_KEY = 'july.paired.v1';
const PREFS_KEY = 'july.prefs.v1';
const USES_KEY = 'july.uses.v1';
/** Certificate trust per oven host (a home CA, or opt-in no checks). */
const TRUST_KEY = 'july.trust.v1';

/**
 * Display choices. The home screen ones follow the Home Assistant card's own Settings
 * (july-oven-card.js): camera frame rate, the name tucking into the icon, the clock
 * and the mode order. (The oven's icon is not a choice here: always the June oven.)
 */
export type Prefs = {
  unit: Unit;
  /** Pictures per second in the camera window. */
  cameraFps: number;
  /** Tuck the oven's name into its icon 5 s after the home screen appears. */
  hideName: boolean;
  clock: 'auto' | '12' | '24';
  /** Mode tiles in the oven's order, or most used first. */
  modeOrder: 'oven' | 'used';
  /** Mode tiles in pages you swipe (8 to a page, Camera and Settings last), or all on one. */
  modesShown: 'pages' | 'all';
};

/**
 * As on the card (v0.4.4): 1 fps is the stock June app's rate. The oven sends about
 * one new still a second, so faster rates mostly re-fetch it; they only apply while
 * the camera window or Live view is open.
 */
export const CAMERA_FPS = [1, 5, 10, 15];
const DEFAULT_PREFS: Prefs = { unit: 'F', cameraFps: 15, hideName: true, clock: 'auto', modeOrder: 'oven', modesShown: 'pages' };

/** Cooks started from this phone, per mode. Kept apart from the settings, so Reset keeps them. */
export type Uses = Record<string, number>;

type Ctx = {
  ready: boolean;
  paired: Paired | null;
  link: OvenLink | null;
  snap: OvenSnapshot;
  prefs: Prefs;
  setUnit(unit: Unit): void;
  setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void;
  /** Put the home screen choices back; units are kept. */
  resetPrefs(): void;
  uses: Uses;
  /** Count a cook started from this phone (on a successful start only). */
  countUse(mode: string): void;
  trusts: Record<string, Trust>;
  /** Trust `host`'s certificate this way from now on (saved), or only as the phone does (null). */
  setHostTrust(host: string, trust: Trust | null): void;
  /** Reach the paired oven another way (HTTPS or the plain port), e.g. after a certificate change. */
  updateConnection(conn: Connection): Promise<void>;
  completePairing(p: Paired): Promise<void>;
  startDemo(): void;
  forget(): Promise<void>;
};

const OvenContext = createContext<Ctx | null>(null);
const EMPTY = emptySnapshot();
const noSubscribe = () => () => {};

export function OvenProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [paired, setPaired] = useState<Paired | null>(null);
  const [link, setLink] = useState<OvenLink | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [uses, setUses] = useState<Uses>({});
  const [trusts, setTrusts] = useState<Record<string, Trust>>({});

  useEffect(() => {
    (async () => {
      const [p, pr, u, tr] = await Promise.all([
        load<Paired>(PAIRED_KEY), load<Partial<Prefs>>(PREFS_KEY), load<Uses>(USES_KEY), load<Record<string, Trust>>(TRUST_KEY),
      ]);
      if (pr) {
        const next = { ...DEFAULT_PREFS, ...pr };
        // Rates from before v0.4.4's choices (0.5, 2) move to the nearest one.
        if (!CAMERA_FPS.includes(next.cameraFps)) next.cameraFps = CAMERA_FPS.reduce((a, b) => (Math.abs(b - next.cameraFps) < Math.abs(a - next.cameraFps) ? b : a));
        setPrefs(next);
      }
      if (u) setUses(u);
      // Before the oven link starts, so its first request already trusts the home CA.
      if (tr) {
        for (const [host, t] of Object.entries(tr)) { try { applyTrust(host, t); } catch {} }
        setTrusts(tr);
      }
      if (p) { setPaired(p); setLink(new LiveOven(p)); }
      // Web dev builds only: ?demo opens straight into the demo oven, for previewing
      // screens; ?demo=cooking (or preheat, ready, probe, done, offline) starts it there.
      else if (__DEV__ && Platform.OS === 'web') {
        const scene = new URLSearchParams(window.location.search).get('demo');
        if (scene !== null) setLink(new DemoOven(DEMO_SCENES.find((d) => d === scene) ?? 'off'));
      }
      setReady(true);
    })();
  }, []);

  const subscribe = useMemo(() => (link ? link.subscribe.bind(link) : noSubscribe), [link]);
  const getSnapshot = useMemo(() => (link ? link.snapshot.bind(link) : () => EMPTY), [link]);
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  // Run the link while the app is in the foreground only.
  useEffect(() => {
    if (!link) return;
    link.start();
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? link.start() : link.stop()));
    return () => { sub.remove(); link.stop(); };
  }, [link]);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => { const next = { ...p, [key]: value }; save(PREFS_KEY, next); return next; });
  }, []);
  const setUnit = useCallback((unit: Unit) => setPref('unit', unit), [setPref]);
  const resetPrefs = useCallback(() => {
    setPrefs((p) => { const next = { ...DEFAULT_PREFS, unit: p.unit }; save(PREFS_KEY, next); return next; });
  }, []);
  const setHostTrust = useCallback((host: string, trust: Trust | null) => {
    applyTrust(host, trust);
    setTrusts((all) => {
      const next = { ...all };
      if (hasTrust(trust)) next[host] = trust; else delete next[host];
      save(TRUST_KEY, next);
      return next;
    });
  }, []);
  const countUse = useCallback((mode: string) => {
    setUses((u) => { const next = { ...u, [mode]: (u[mode] ?? 0) + 1 }; save(USES_KEY, next); return next; });
  }, []);

  const completePairing = useCallback(async (p: Paired) => {
    await save(PAIRED_KEY, p);
    setPaired(p);
    setLink(new LiveOven(p));
  }, []);

  const updateConnection = useCallback(async (conn: Connection) => {
    if (!paired) return;
    const next = { ...paired, conn };
    await save(PAIRED_KEY, next);
    setPaired(next);
    setLink(new LiveOven(next));
  }, [paired]);

  const startDemo = useCallback(() => {
    setPaired(null);
    setLink(new DemoOven());
  }, []);

  const forget = useCallback(async () => {
    await link?.unpair().catch(() => {});
    await remove(PAIRED_KEY);
    if (paired) setHostTrust(paired.conn.host, null);
    setPaired(null);
    setLink(null);
  }, [link, paired, setHostTrust]);


  const value = useMemo<Ctx>(
    () => ({ ready, paired, link, snap, prefs, setUnit, setPref, resetPrefs, uses, countUse, trusts, setHostTrust, updateConnection, completePairing, startDemo, forget }),
    [ready, paired, link, snap, prefs, setUnit, setPref, resetPrefs, uses, countUse, trusts, setHostTrust, updateConnection, completePairing, startDemo, forget],
  );
  return <OvenContext.Provider value={value}>{children}</OvenContext.Provider>;
}

export function useOven(): Ctx {
  const c = useContext(OvenContext);
  if (!c) throw new Error('useOven outside OvenProvider');
  return c;
}

/** Display name for the connected oven. */
export function useOvenName(): string {
  const { paired, link } = useOven();
  return link?.demo ? 'Demo oven' : paired?.oven.name ?? 'Your oven';
}
