// Live camera pictures for whoever is showing them. Watches only while `on` and
// the app is in front: closing the stream lets the oven turn its camera and
// interior light off again.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useOven } from '@/state/oven';

export function useCameraFeed(on = true): string | null {
  const { link, prefs } = useOven();
  const [src, setSrc] = useState<string | null>(null);
  const stillMs = 1000 / prefs.cameraFps;

  useEffect(() => {
    if (!link || !on) return;
    let stop: (() => void) | null = null;
    const start = () => { stop ??= link.watchCamera(setSrc, stillMs); };
    const pause = () => { stop?.(); stop = null; };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : pause()));
    return () => { sub.remove(); pause(); };
  }, [link, on, stillMs]);

  return src;
}
