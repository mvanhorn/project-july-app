// The Still Glass oven tile: the Home Assistant July Oven card's layout on a phone
// (prj-july/ha-june-oven, docs/july-oven-card/DESIGN.md, v0.4.1). One job per state:
//
//   off      the oven's home screen, drawn on the app itself rather than in a card:
//            its icon and name top left, the clock, the last cook with Repeat, then
//            the mode tiles and Camera, four across, sized to the phone (Settings is
//            in the top bar)
//   running  icon + name, red Stop | big number, status line, heat line
//            +1 · +5 · +10 while a timer runs (the camera is its own tile below)
//   done     "Take food out", with Food is out in Stop's place
//   offline  last values, dimmed
//
// The icon is the oven's lamp; on the home screen the name tucks into it after 5 s.
// Every margin is the card's padding, measured to the ink.
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OvenSnapshot } from '@/api/client';
import { fToC, formatDuration, modeLabel, show, tileModes, type Unit } from '@/api/modes';
import { useOven, type LastCook } from '@/state/oven';
import { space, useTheme } from '@/theme';
import { GlassFill, ModeTile, StatusLine, type MarkKind } from './glass';
import { Icon } from './Icon';
import { OvenButton } from './OvenButton';
import type { Lamp } from './OvenIcon';
import { remainingNow, useNow } from './OvenHero';
import { Chip, ProgressBar, type BarKind } from './ui';

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
  /** Open the review for the last cook again (mode and °F). */
  onRepeat: (mode: string, tempF: number) => void;
  /** This oven's last cook started from this phone, for Repeat. */
  lastCook: LastCook | null;
  /** Open the camera full screen (the Camera tile on the home screen). */
  onCamera: () => void;
  /** The last cook completed and nobody dismissed it; `at` is when, if known. */
  done: { at: number | null } | null;
  onDismissDone: () => void;
};

/** "Today 18:20", "Yesterday 18:20", "Sunday 18:20", or the date further back. */
function when(at: number, now: number) {
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / 86_400_000);
  const days = day(now) - day(at);
  if (days <= 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days < 7) return `${d.toLocaleDateString([], { weekday: 'long' })} ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ago(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

type Model = {
  lamp: Lamp; state: string; mark: MarkKind; word: string; q?: string;
  hero: string; heroText?: boolean; stale?: boolean; bar: [BarKind, number];
  a: string; b: string; action: 'stop' | 'dismiss' | null; chips: boolean;
};

/** What the running card shows, from the oven's state (DESIGN.md, "States"; the card's ovenModel). */
function model(s: OvenSnapshot, unit: Unit, left: number | null, now: number, done: { at: number | null } | null): Model {
  const offline = s.link === 'offline' || s.ovenOnline === false;
  const u = `°${unit}`;
  const target = s.targetC !== null ? show(s.targetC, unit) : null;
  const oven = `${show(s.cavityC, unit)}°`;
  const label = modeLabel(s.mode);
  const elapsed = s.elapsedMs ?? 0;
  const base = { chips: false, action: 'stop' as const, lamp: 'on' as const };
  if (offline) {
    return {
      ...base, lamp: 'lost', state: 'offline', mark: 'offline', word: 'Offline', q: 'last reading', hero: oven, stale: true, bar: ['stale', 0.5],
      a: 'Oven not responding', b: s.active ? `Last seen ${s.phase === 'preheating' ? 'heating' : 'cooking'} · ${label}` : 'Check that the oven is on and connected',
      action: s.active ? 'stop' : null,
    };
  }
  if (!s.active && done) {
    return {
      ...base, lamp: 'off', state: 'done', mark: 'done', word: 'Done', hero: 'Take food out', heroText: true, bar: ['done', 1],
      a: done.at !== null ? `Done ${ago(now - done.at)}` : 'Done', b: s.probeC !== null ? `Food ${show(s.probeC, unit)} ${u} · ${label}` : label,
      action: 'dismiss',
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
      ...base, state: 'cooking', mark: 'cooking', word: 'Cooking', q: s.probeTargetC !== null ? `food · target ${show(s.probeTargetC, unit)}°` : 'food', hero: `${show(s.probeC, unit)}°`, bar: ['heat', s.progress ?? 1],
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
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const boxRef = useRef<View>(null);
  const [boxTop, setBoxTop] = useState<number | null>(null);
  // Screens hidden in the stack lay out at 0 wide; keep the last real width.
  const onLayout = (e: LayoutChangeEvent) => {
    const lw = e.nativeEvent.layout.width;
    if (lw >= 200) setW(lw);
    // Where the home screen starts on screen, to size it to the room below.
    boxRef.current?.measureInWindow((_x, y) => setBoxTop(Math.round(y)));
  };
  const s = p.s;
  const now = useNow(true, 1000);
  const left = remainingNow(s, now);
  const offline = s.link === 'offline' || s.ovenOnline === false;
  const done = p.done && (p.done.at === null || now - p.done.at < DONE_WINDOW_MS) ? p.done : null;
  const home = !offline && !s.active && !done;

  // --- Off: the oven's home screen ---------------------------------------------------
  if (home) {
    const d = new Date(now);
    const hour12 = prefs.clock === '12' ? true : prefs.clock === '24' ? false
      : new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 !== false;
    const h = d.getHours();
    // The oven's clock: no AM/PM.
    const clock = `${hour12 ? h % 12 || 12 : String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    // Last cook, for Repeat (nothing until the first one). The demo shows a sample so
    // the row can be reviewed.
    const last = p.lastCook ?? (p.demo ? { mode: 'bake', tempF: 400, at: now - 26 * 3_600_000 } : null);
    // Four across, reaching the screen's margins on both sides (DESIGN.md: equal margins).
    const cols = 4;
    const gap = Math.min(20, Math.max(10, w * 0.034));
    const tile = Math.floor(Math.min((w - (cols - 1) * gap) / cols, 104));
    // A row: the tile, 7 px, a 20 px label, then 10 px to the next row.
    const rowPitch = tile + 37;
    // The modes, then Camera. Settings lives in the top bar.
    type Tile = { id: string; label: string; util?: boolean; untested?: boolean };
    const tiles: Tile[] = [
      ...tileModes(prefs.modeOrder, uses).map((m) => ({ id: m.id, label: m.label, untested: m.untested })),
      { id: 'camera', label: 'Camera', util: true },
    ];
    const rowsNeeded = Math.ceil(tiles.length / cols);
    // Sized to the phone: the oven-sized clock if every row still fits below it; else
    // the clock shrinks (down to the card's size) to make them fit; only then does the
    // screen scroll. Sideways swipes belong to the ovens, so the tiles never page.
    const bigClock = Math.min(w * 0.26, 110);
    const smallClock = Math.min(w * 0.15, 76);
    const gridH = rowsNeeded * rowPitch - 10;
    const above = (last ? 56 + space[4] : 0) + space[5];
    // The room: from the top of the home screen to the screen's bottom margin.
    const room = boxTop === null ? null : winH - boxTop - space[6] - insets.bottom - above;
    let clockSize = bigClock;
    if (room !== null && bigClock * 0.8 + 22 + gridH > room) clockSize = Math.max(smallClock, (room - gridH - 22) / 0.8);
    const rows: Tile[][] = [];
    for (let i = 0; i < tiles.length; i += cols) rows.push(tiles.slice(i, i + cols));
    const grid = () => {
      return (
        <View style={{ gap: 10 }}>
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
                  onPress={() => (t.id === 'camera' ? p.onCamera() : p.onMode(t.id))}
                  accessibilityLabel={t.util ? `${t.label} for ${p.name}` : `${t.label}${t.untested ? ', untested' : ''}: review and start`}
                />
              ))}
              {/* Keep a short last row on the grid. */}
              {Array.from({ length: cols - row.length }, (_, k) => <View key={`pad${k}`} style={{ width: tile }} />)}
            </View>
          ))}
        </View>
      );
    };
    const lastTemp = last ? (p.unit === 'F' ? `${last.tempF} °F` : `${Math.round(fToC(last.tempF))} °C`) : '';
    return (
      <View ref={boxRef} onLayout={onLayout} style={{ paddingTop: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
          <View style={{ flex: 1, minWidth: 0, marginTop: -6 }}>
            <OvenButton name={p.name} lamp="off" state="off" tuck={prefs.hideName} size={w < 400 ? 18 : 22} />
          </View>
          <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`Time ${clock}, ${date}`}>
            <Text style={{ fontFamily: f.number, fontSize: clockSize, lineHeight: clockSize * 0.95, marginTop: -clockSize * 0.15, fontVariant: ['tabular-nums'], color: c.ink }}>{clock}</Text>
            <Text style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 18, color: c.inkMuted, marginTop: 4 }}>{date}</Text>
          </View>
          <View style={{ flex: 1 }} />
        </View>
        {last ? (
          // Repeat opens the review with the same mode and temperature: nothing heats until Start.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Repeat the last cook, ${modeLabel(last.mode)} at ${lastTemp}: review and start`}
            onPress={() => p.onRepeat(last.mode, last.tempF)}
            style={({ pressed }) => [styles.last, { borderRadius: r.md, borderColor: c.line, backgroundColor: pressed ? c.surfaceSunken : 'transparent' }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: f.sansMedium, fontSize: 16, lineHeight: 21, color: c.ink }}>{`Last cook: ${modeLabel(last.mode)} ${lastTemp}`}</Text>
              <Text numberOfLines={1} style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 19, color: c.inkMuted }}>{when(last.at, now)}</Text>
            </View>
            <Text style={{ fontFamily: f.sansStrong, fontSize: 16, color: c.ember }}>Repeat</Text>
          </Pressable>
        ) : null}
        <View style={{ marginTop: space[5] }}>{grid()}</View>
      </View>
    );
  }

  // --- Running, done and offline ------------------------------------------------------
  // A card of its own; the camera is a separate tile below it.
  const m = model(s, p.unit, left, now, done);
  const inner = w - PX * 2;
  // "19:07" is the widest number at about 1.86 em with tabular figures (measured,
  // Barlow Condensed); long timers ("1:05:00") use a smaller size.
  const hs = Math.min(inner * 0.3, 112, m.hero.length > 5 ? inner / 2.9 : inner);
  const hts = Math.min(w * 0.095, 40);
  const actionW = Math.round(Math.min(inner * 0.42, 172));
  const deg = !m.heroText && m.hero.endsWith('°');
  const heroText = deg ? m.hero.slice(0, -1) : m.hero;

  return (
    <View onLayout={onLayout} style={[styles.card, { borderRadius: r.lg, borderColor: c.line, backgroundColor: c.surfaceRaised }]}>
      <GlassFill />
      <View style={{ paddingHorizontal: PX, paddingTop: 14, paddingBottom: PX, gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <OvenButton name={p.name} lamp={m.lamp} state={m.state} tuck={false} />
          </View>
          {m.action === 'stop' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Stop the ${p.name} oven`}
              disabled={p.stopping}
              onPress={p.onStop}
              style={({ pressed }) => [styles.action, { width: actionW, borderRadius: r.md, backgroundColor: c.stop, opacity: p.stopping ? 0.75 : pressed ? 0.88 : 1 }]}
            >
              <View style={{ width: 13, height: 13, borderRadius: 2, backgroundColor: c.onStop }} />
              <Text style={{ fontFamily: f.sansStrong, fontSize: 17, color: c.onStop }}>{p.stopping ? 'Stopping…' : 'Stop'}</Text>
            </Pressable>
          ) : m.action === 'dismiss' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Dismiss: food is out of the ${p.name} oven`}
              onPress={p.onDismissDone}
              style={({ pressed }) => [styles.action, { width: actionW, borderRadius: r.md, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: pressed ? c.surfaceSunken : 'transparent' }]}
            >
              <Icon name="check-circle" size={18} color={c.ready} />
              <Text style={{ fontFamily: f.sansMedium, fontSize: 16, color: c.ink }}>Food is out</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          {m.heroText ? (
            <Text accessibilityRole="header" style={{ fontFamily: f.number, fontSize: hts, lineHeight: hts * 1.1, color: c.ink }}>{m.hero}</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  action: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  last: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, marginTop: space[4], paddingHorizontal: space[4], borderWidth: 1 },
});
