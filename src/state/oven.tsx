import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { LiveOven, emptySnapshot, type OvenLink, type OvenSnapshot, type Paired } from '@/api/client';
import { DemoOven } from '@/api/demo';
import type { Unit } from '@/api/modes';
import { load, remove, save } from './storage';

const PAIRED_KEY = 'july.paired.v1';
const PREFS_KEY = 'july.prefs.v1';

type Prefs = { unit: Unit };

type Ctx = {
  ready: boolean;
  paired: Paired | null;
  link: OvenLink | null;
  snap: OvenSnapshot;
  prefs: Prefs;
  setUnit(unit: Unit): void;
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
  const [prefs, setPrefs] = useState<Prefs>({ unit: 'F' });

  useEffect(() => {
    (async () => {
      const [p, pr] = await Promise.all([load<Paired>(PAIRED_KEY), load<Prefs>(PREFS_KEY)]);
      if (pr) setPrefs(pr);
      if (p) { setPaired(p); setLink(new LiveOven(p)); }
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

  const setUnit = useCallback((unit: Unit) => {
    setPrefs((p) => { const next = { ...p, unit }; save(PREFS_KEY, next); return next; });
  }, []);

  const completePairing = useCallback(async (p: Paired) => {
    await save(PAIRED_KEY, p);
    setPaired(p);
    setLink(new LiveOven(p));
  }, []);

  const startDemo = useCallback(() => {
    setPaired(null);
    setLink(new DemoOven());
  }, []);

  const forget = useCallback(async () => {
    await link?.unpair().catch(() => {});
    await remove(PAIRED_KEY);
    setPaired(null);
    setLink(null);
  }, [link]);


  const value = useMemo<Ctx>(
    () => ({ ready, paired, link, snap, prefs, setUnit, completePairing, startDemo, forget }),
    [ready, paired, link, snap, prefs, setUnit, completePairing, startDemo, forget],
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
