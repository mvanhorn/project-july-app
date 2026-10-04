// The Still Glass oven tile: the Home Assistant July Oven card's layout on a phone
// (prj-july/ha-june-oven, docs/july-oven-card/DESIGN.md, v0.4.1). One job per state:
//
//   off      the oven's home screen: its icon and name top left, the clock, then the
//            mode tiles with Camera and Settings last (4 × 3 here: a phone has the height)
//   running  icon + name, red Stop | big number, status line, heat line | 4:3 camera
//            +1 · +5 · +10 while a timer runs
//   done     "Take food out", with Food is out in Stop's place
//   offline  last values, dimmed
//
// The icon is the oven's lamp; on the home screen the name tucks into it after 5 s.
// The camera opens a floating window over the card. Every margin is the card's
// padding, measured to the ink.
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import type { OvenSnapshot } from '@/api/client';
import { TOP_MODES, formatDuration, modeLabel, show, tileModes, type Unit } from '@/api/modes';
import { useOven } from '@/state/oven';
import { space, useTheme } from '@/theme';
import { CameraWindow } from './CameraWindow';
import { CameraPill, GlassFill, ModeTile, StatusLine, type MarkKind } from './glass';
import { Icon } from './Icon';
import { OvenButton } from './OvenButton';
import type { Lamp } from './OvenIcon';
import { remainingNow, useNow } from './OvenHero';
import { Chip, ProgressBar, type BarKind } from './ui';

const DEMO_IMAGE = require('../../assets/demo-camera.jpg');
const PX = 16;
const GAP = 16;
/** Done lasts 30 minutes after the cook completes, unless dismissed. */
export const DONE_WINDOW_MS = 30 * 60_000;

type Props = {
  s: OvenSnapshot;
  unit: Unit;
  demo: boolean;
  name: string;
  onStop: () => void;
  stopping: boolean;
  onAddMinutes: (min: number) => void;
  onMode: (mode: string) => void;
  onSettings: () => void;
  /** The last cook completed and nobody dismissed it; `at` is when, if known. */
  done: { at: number | null } | null;
  onDismissDone: () => void;
};

function ago(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

type Model = {
  lamp: Lamp; state: string; mark: MarkKind; word: string; q?: string;
  hero: string; heroText?: boolean; stale?: boolean; bar: [BarKind, number];
  a: string; b: string; action: 'stop' | 'dismiss' | null; chips: boolean; camera: 'live' | 'still';
};

/** What the running card shows, from the oven's state (DESIGN.md, "States"; the card's ovenModel). */
function model(s: OvenSnapshot, unit: Unit, left: number | null, now: number, done: { at: number | null } | null): Model {
  const offline = s.link === 'offline' || s.ovenOnline === false;
  const u = `°${unit}`;
  const target = s.targetC !== null ? show(s.targetC, unit) : null;
  const oven = `${show(s.cavityC, unit)}°`;
  const label = modeLabel(s.mode);
  const elapsed = s.elapsedMs ?? 0;
  const base = { chips: false, camera: 'live' as const, action: 'stop' as const, lamp: 'on' as const };
  if (offline) {
    return {
      ...base, lamp: 'lost', state: 'offline', mark: 'offline', word: 'Offline', q: 'last reading', hero: oven, stale: true, bar: ['stale', 0.5],
      a: 'Oven not responding', b: s.active ? `Last seen ${s.phase === 'preheating' ? 'heating' : 'cooking'} · ${label}` : 'Check that the oven is on and connected',
      action: s.active ? 'stop' : null, camera: 'still',
    };
  }
  if (!s.active && done) {
    return {
      ...base, lamp: 'off', state: 'done', mark: 'done', word: 'Done', hero: 'Take food out', heroText: true, bar: ['done', 1],
      a: done.at !== null ? `Done ${ago(now - done.at)}` : 'Done', b: s.probeC !== null ? `Food ${show(s.probeC, unit)} ${u} · ${label}` : label,
      action: 'dismiss', camera: 'still',
    };
  }
  if (s.phase === 'preheating') {
    return {
      ...base, state: 'preheating', mark: 'preheat', word: 'Preheating', hero: oven, bar: ['preheat', s.progress ?? 0],
      a: target ? `Heating to ${target} ${u}` : 'Heating', b: left !== null ? `${label} · timer ${formatDuration(left)} once hot` : label,
    };
  }
  const facts = `${label}${target ? ` ${target} ${u}` : ''}${s.probeC !== null ? ` · food ${show(s.probeC, unit)}°` : ''}`;
  if (left !== null) {
    const total = elapsed + left;
    const at = new Date(now + left).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return {
      ...base, state: 'cooking', mark: 'cooking', word: 'Cooking', q: 'left', hero: formatDuration(left),
      bar: ['heat', total > 0 ? elapsed / total : 0], a: `Done at ${at}`, b: facts, chips: true,
    };
  }
  if (s.probeC !== null) {
    return {
      ...base, state: 'cooking', mark: 'cooking', word: 'Cooking', q: 'food', hero: `${show(s.probeC, unit)}°`, bar: ['heat', s.progress ?? 1],
      a: `${label}${target ? ` at ${target} ${u}` : ''}`, b: s.elapsedMs !== null ? `Cooking for ${Math.round(elapsed / 60_000)} min` : '',
    };
  }
  // Hot, no timer and no probe: the oven holds its temperature.
  return {
    ...base, state: 'ready', mark: 'ready', word: 'Ready', q: 'holding', hero: oven, bar: ['heat', 1],
    a: 'Put food in', b: `${label}${target ? ` · ${target} ${u}` : ''}`,
  };
}

export function GlassHero(p: Props) {
  const { c, f, r } = useTheme();
  const { prefs, uses } = useOven();
  const [w, setW] = useState(372);
  const [camera, setCamera] = useState(false);
  const [allModes, setAllModes] = useState(false);
  // Screens hidden in the stack lay out at 0 wide; keep the last real width.
  const onLayout = (e: LayoutChangeEvent) => { const lw = e.nativeEvent.layout.width; if (lw >= 200) setW(lw); };
  const closeCamera = useCallback(() => setCamera(false), []);
  const s = p.s;
  const now = useNow(true, 1000);
  const left = remainingNow(s, now);
  const inner = w - PX * 2;
  const offline = s.link === 'offline' || s.ovenOnline === false;
  const done = p.done && (p.done.at === null || now - p.done.at < DONE_WINDOW_MS) ? p.done : null;
  const home = !offline && !s.active && !done;

  const shell = (children: ReactNode) => (
    <View onLayout={onLayout} style={[styles.card, { borderRadius: r.lg, borderColor: c.line, backgroundColor: c.surfaceRaised }]}>
      <GlassFill />
      {children}
      {camera ? <CameraWindow name={p.name} heating={s.active} onClose={closeCamera} /> : null}
    </View>
  );

  // --- Off: the oven's home screen ---------------------------------------------------
  if (home) {
    const d = new Date(now);
    const hour12 = prefs.clock === '12' ? true : prefs.clock === '24' ? false
      : new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 !== false;
    const h = d.getHours();
    // The oven's clock: no AM/PM.
    const clock = `${hour12 ? h % 12 || 12 : String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const clockSize = Math.min(w * 0.15, 76);
    // Four across, reaching the card's padding on both sides (DESIGN.md: equal margins).
    const gap = Math.min(20, Math.max(10, w * 0.034));
    const tile = Math.floor(Math.min((inner - 3 * gap) / 4, 104));
    // The top six (with Camera and Settings, the card's 4 × 2) unless all were asked for.
    const modes = tileModes(prefs.modeOrder, uses);
    const folds = prefs.modesShown === 'top' && modes.length > TOP_MODES;
    const shown = folds && !allModes ? modes.slice(0, TOP_MODES) : modes;
    const tiles: { id: string; label: string; util?: boolean; untested?: boolean }[] = [
      ...shown.map((m) => ({ id: m.id, label: m.label, untested: m.untested })),
      { id: 'camera', label: 'Camera', util: true },
      { id: 'settings', label: 'Settings', util: true },
    ];
    const rows: (typeof tiles)[] = [];
    for (let i = 0; i < tiles.length; i += 4) rows.push(tiles.slice(i, i + 4));
    return shell(
      <View style={{ padding: PX }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <View style={{ flex: 1, minWidth: 0, marginTop: -6 }}>
            <OvenButton name={p.name} icon={prefs.icon} lamp="off" state="off" tuck={prefs.hideName} size={w < 400 ? 18 : 22} />
          </View>
          <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`Time ${clock}, ${date}`}>
            <Text style={{ fontFamily: f.number, fontSize: clockSize, lineHeight: clockSize * 0.95, marginTop: -clockSize * 0.15, fontVariant: ['tabular-nums'], color: c.ink }}>{clock}</Text>
            <Text style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 18, color: c.inkMuted, marginTop: 4 }}>{date}</Text>
          </View>
          <View style={{ flex: 1 }} />
        </View>
        <View style={{ marginTop: space[8], gap: 10 }}>
          {rows.map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {row.map((t) => (
                <ModeTile
                  key={t.id}
                  mode={t.id}
                  label={t.label}
                  util={t.util}
                  untested={t.untested}
                  size={tile}
                  labelWidth={tile + gap}
                  onPress={() => (t.id === 'camera' ? setCamera(true) : t.id === 'settings' ? p.onSettings() : p.onMode(t.id))}
                  accessibilityLabel={t.util ? `${t.label} for ${p.name}` : `${t.label}${t.untested ? ', untested' : ''}: review and start`}
                />
              ))}
              {/* Keep a short last row on the grid. */}
              {Array.from({ length: 4 - row.length }, (_, k) => <View key={`pad${k}`} style={{ width: tile }} />)}
            </View>
          ))}
        </View>
        {folds ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: allModes }}
            onPress={() => setAllModes((a) => !a)}
            style={({ pressed }) => [styles.more, { borderRadius: r.md, backgroundColor: pressed ? c.surfaceSunken : 'transparent' }]}
          >
            <Text style={{ fontFamily: f.sansMedium, fontSize: 16, color: c.inkMuted }}>{allModes ? 'Fewer modes' : `All ${modes.length} modes`}</Text>
            <Icon name={allModes ? 'chevron-up' : 'chevron-down'} size={20} color={c.inkMuted} />
          </Pressable>
        ) : null}
      </View>,
    );
  }

  // --- Running, done and offline ------------------------------------------------------
  const m = model(s, p.unit, left, now, done);
  // The camera spans the number group (number, status line, bar), so its size follows
  // the number; the number gives up at most 10% to fit beside it. "19:07" is the
  // widest number at about 1.86 em with tabular figures (measured, Barlow Condensed); long timers ("1:05:00") use a smaller size.
  const hs0 = Math.min(inner * 0.27, 100);
  const camW = Math.round(Math.min((hs0 * 0.95 + 44) * 4 / 3, inner * 0.46));
  const leftW = inner - camW - GAP;
  const hs = Math.max(Math.min(hs0, leftW / (m.hero.length > 5 ? 2.7 : 1.92)), m.hero.length > 5 ? 0 : hs0 * 0.9);
  const hts = Math.min(w * 0.095, 40);
  const image = p.demo ? (s.imageUrl ? DEMO_IMAGE : null) : s.imageUrl ? { uri: s.imageUrl } : null;
  const age = s.imageAt ? now - s.imageAt : null;
  const live = m.camera === 'live' && age !== null && age < 5000;
  const deg = !m.heroText && m.hero.endsWith('°');
  const heroText = deg ? m.hero.slice(0, -1) : m.hero;

  return shell(
    <View style={{ paddingHorizontal: PX, paddingTop: 14, paddingBottom: PX, gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <OvenButton name={p.name} icon={prefs.icon} lamp={m.lamp} state={m.state} tuck={false} />
        </View>
        {m.action === 'stop' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Stop the ${p.name} oven`}
            disabled={p.stopping}
            onPress={p.onStop}
            style={({ pressed }) => [styles.action, { width: camW, borderRadius: r.md, backgroundColor: c.stop, opacity: p.stopping ? 0.75 : pressed ? 0.88 : 1 }]}
          >
            <View style={{ width: 13, height: 13, borderRadius: 2, backgroundColor: c.onStop }} />
            <Text style={{ fontFamily: f.sansStrong, fontSize: 17, color: c.onStop }}>{p.stopping ? 'Stopping…' : 'Stop'}</Text>
          </Pressable>
        ) : m.action === 'dismiss' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Dismiss: food is out of the ${p.name} oven`}
            onPress={p.onDismissDone}
            style={({ pressed }) => [styles.action, { width: camW, borderRadius: r.md, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: pressed ? c.surfaceSunken : 'transparent' }]}
          >
            <Icon name="check-circle" size={18} color={c.ready} />
            <Text style={{ fontFamily: f.sansMedium, fontSize: 16, color: c.ink }}>Food is out</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: GAP, alignItems: 'flex-start' }}>
        <View style={{ width: leftW, gap: 6 }}>
          {m.heroText ? (
            <Text accessibilityRole="header" style={{ fontFamily: f.number, fontSize: hts, lineHeight: hts * 1.1, color: c.ink, minHeight: hs * 0.95 }}>{m.hero}</Text>
          ) : (
            // The degree sign at half size, level with the top of the digits.
            <View
              accessible
              accessibilityLabel={m.q === 'left' ? `${m.hero} left` : `${heroText} degrees`}
              style={{ flexDirection: 'row', alignItems: 'flex-start', opacity: m.stale ? 0.42 : 1 }}
            >
              <Text numberOfLines={1} style={{ fontFamily: f.number, fontSize: hs, lineHeight: hs * 0.95, fontVariant: ['tabular-nums'], color: c.ink }}>{heroText}</Text>
              {deg ? <Text style={{ fontFamily: f.number, fontSize: hs * 0.5, lineHeight: hs * 0.5, marginTop: hs * 0.04, color: c.ink }}>°</Text> : null}
            </View>
          )}
          <StatusLine kind={m.mark} word={m.word} qualifier={m.q} size="small" />
          <View style={{ marginTop: 4 }}>
            <ProgressBar value={m.bar[1]} color={m.bar[0] === 'done' ? c.ready : c.ember} kind={m.bar[0]} />
          </View>
        </View>
        <View style={{ width: camW }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Oven camera, ${live ? 'live' : 'last picture'}. Open larger view`}
            onPress={() => setCamera(true)}
            style={[styles.cam, { borderRadius: r.md, backgroundColor: c.win }]}
          >
            {image ? (
              <>
                <Image source={image} style={StyleSheet.absoluteFill} contentFit="contain" transition={200} />
                <CameraPill old={!live}>{live ? 'LIVE' : age !== null ? ago(age).replace(/ ago$/, '') : '—'}</CameraPill>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Icon name="camera" size={20} color={c.inkMuted} />
                <Text style={{ fontFamily: f.sansMedium, fontSize: 12, color: c.inkMuted }}>{s.active ? 'Waking…' : 'Camera off'}</Text>
              </View>
            )}
            {/* A faint ring inside the window, like the tiles' rim, with Stop's corners. */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r.md, borderWidth: 1, borderColor: c.utilRim }]} />
            <View pointerEvents="none" style={[styles.camSheen, { borderTopLeftRadius: r.md, borderTopRightRadius: r.md, borderTopColor: c.tileSheen }]} />
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: f.sansMedium, fontSize: 17, lineHeight: 22, color: c.ink }} numberOfLines={2}>{m.a}</Text>
        {m.b ? <Text style={{ fontFamily: f.sans, fontSize: 15, lineHeight: 20, color: c.inkMuted }} numberOfLines={2}>{m.b}</Text> : null}
      </View>

      {m.chips ? (
        <View accessibilityRole="toolbar" accessibilityLabel={`Add time to the ${p.name} timer`} style={{ flexDirection: 'row', gap: space[2], marginTop: space[1] }}>
          {[1, 5, 10].map((n) => (
            <Chip key={n} compact onPress={() => p.onAddMinutes(n)} accessibilityLabel={`Add ${n} minute${n > 1 ? 's' : ''} to ${p.name}`}>{`+${n}`}</Chip>
          ))}
        </View>
      ) : null}
    </View>,
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  action: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cam: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  camSheen: { position: 'absolute', left: 1, right: 1, top: 1, height: 2, borderTopWidth: 1 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: space[2], marginBottom: -space[2] },
});
