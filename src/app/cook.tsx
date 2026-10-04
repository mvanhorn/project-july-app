import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { OvenError } from '@/api/client';
import { MODES, cToF, fToC, formatDuration } from '@/api/modes';
import { GlassFill, ModeTile } from '@/components/glass';
import { Icon } from '@/components/Icon';
import { useNow } from '@/components/OvenHero';
import { Slider } from '@/components/Slider';
import { Button, Chip, Notice, RoundButton, Screen, SectionLabel, T } from '@/components/ui';
import { useOven, useOvenName } from '@/state/oven';
import { space, useTheme } from '@/theme';

const TIMERS = [0, 10, 15, 20, 30, 45, 60, 90];
// Glass: the review closes itself after 5 minutes (the UL 1026 remote-programming
// window), so nothing can start from a screen left open on the counter.
const REVIEW_MS = 5 * 60_000;
const STEP_F = 5;

export default function Cook() {
  const { look } = useTheme();
  const { link, prefs, countUse } = useOven();
  const glass = look.hero === 'glass';
  const unit = prefs.unit;
  const params = useLocalSearchParams<{ mode?: string }>();
  const [modeId, setModeId] = useState(MODES.some((m) => m.id === params.mode) ? params.mode! : 'bake');
  const mode = MODES.find((m) => m.id === modeId)!;
  // Held in °F on 5° steps, the oven's native scale; °C is shown rounded.
  const [tempF, setTempF] = useState(mode.defaultF);
  const [timerMin, setTimerMin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = unit === 'F' ? tempF : Math.round(fToC(tempF));
  const pick = (id: string) => {
    const m = MODES.find((x) => x.id === id)!;
    setModeId(id);
    setTempF(m.defaultF);
  };
  const clampF = (f: number) => Math.min(mode.maxF, Math.max(mode.minF, Math.round(f / STEP_F) * STEP_F));
  const nudge = (d: 1 | -1) => setTempF((t) => clampF(t + d * STEP_F));

  async function start() {
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      await link.preheat(mode.id, fToC(tempF));
      // Counted only when the oven accepts: a review opened and cancelled is not a use.
      countUse(mode.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (timerMin) await link.setTimer(timerMin * 60_000).catch(() => {});
      router.back();
    } catch (e) {
      setError(e instanceof OvenError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const timer = (
    <View style={{ gap: space[3] }}>
      <SectionLabel>Timer (optional)</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {TIMERS.map((m) => (
          <Chip key={m} selected={timerMin === m} onPress={() => setTimerMin(m)}>
            {m === 0 ? 'No timer' : m < 60 ? `${m} min` : `${m / 60 === 1 ? '1 hr' : '1½ hr'}`}
          </Chip>
        ))}
      </View>
    </View>
  );

  if (glass) {
    return (
      <GlassReview
        mode={mode} tempF={tempF} setTempF={(f) => setTempF(clampF(f))} nudge={nudge} unit={unit}
        busy={busy} error={error} onStart={start} timer={timer}
      />
    );
  }
  return <JulyCook modeId={modeId} pick={pick} tempF={tempF} shown={shown} nudge={nudge} unit={unit} busy={busy} error={error} onStart={start} timer={timer} />;
}

// --- Still Glass: the card's review (july-oven-card.js, review) ------------------

function GlassReview({ mode, tempF, setTempF, nudge, unit, busy, error, onStart, timer }: {
  mode: (typeof MODES)[number]; tempF: number; setTempF: (f: number) => void; nudge: (d: 1 | -1) => void; unit: 'F' | 'C';
  busy: boolean; error: string | null; onStart: () => void; timer: React.ReactNode;
}) {
  const { c, f, r, t } = useTheme();
  const name = useOvenName();
  const [openedAt] = useState(() => Date.now());
  const now = useNow(true);
  const closesIn = Math.max(0, REVIEW_MS - (now - openedAt));
  // What is being typed into the number, until Enter or leaving the field.
  const [typed, setTyped] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { if (router.canGoBack()) router.back(); }, REVIEW_MS);
    return () => clearTimeout(id);
  }, []);

  const toF = (v: number) => (unit === 'F' ? v : cToF(v));
  const fromF = (v: number) => (unit === 'F' ? v : Math.round(fToC(v)));
  const lo = fromF(mode.minF);
  const hi = fromF(mode.maxF);
  const shown = fromF(tempF);

  function onType(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 3);
    setTyped(digits);
    // The slider follows any value in range; the number snaps when committed.
    const v = parseInt(digits, 10);
    if (v >= lo && v <= hi) setTempF(toF(v));
  }
  function commit() {
    const v = parseInt(typed ?? '', 10);
    if (Number.isFinite(v)) setTempF(toF(Math.max(lo, Math.min(hi, v))));
    setTyped(null);
  }

  return (
    <>
      <Stack.Screen options={{ title: `${mode.label} · ${name}` }} />
      <Screen
        footer={
          <>
            {error ? <Notice tone="warning" title="The oven didn't start">{error}</Notice> : null}
            <T v="small" muted>
              Make sure the oven is empty and the door is closed. Nothing heats until you press Start. This closes in{' '}
              <Text style={{ fontFamily: f.sansStrong, color: c.ink }}>{formatDuration(closesIn)}</Text>.
            </T>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <Button style={{ flexGrow: 0, flexShrink: 0, minWidth: 116 }} onPress={() => router.back()}>Not now</Button>
              <Button style={{ flex: 1 }} variant="primary" busy={busy} onPress={onStart}>Start preheating</Button>
            </View>
          </>
        }
      >
        <Text style={[t.label, { color: c.inkMuted, marginBottom: -space[3] }]}>Step 2 of 2 · Review</Text>

        <View style={[styles.tempBox, { borderRadius: r.lg, borderColor: c.line, backgroundColor: c.surfaceRaised }]}>
          <GlassFill />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <ModeTile mode={mode.id} label="" size={64} accessibilityLabel={mode.label} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <RoundButton icon="minus" label="Lower the temperature" onPress={() => nudge(-1)} disabled={tempF <= mode.minF} size={48} />
              <Pressable style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }} accessible={false}>
                <TextInput
                  value={typed ?? String(shown)}
                  onChangeText={onType}
                  onFocus={() => { setFocused(true); setTyped(String(shown)); }}
                  onBlur={() => { setFocused(false); commit(); }}
                  onSubmitEditing={commit}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={3}
                  selectTextOnFocus
                  accessibilityLabel={`Temperature in °${unit}: type a number from ${lo} to ${hi}`}
                  style={{
                    width: 92, paddingVertical: 0, paddingBottom: 2, textAlign: 'center',
                    fontFamily: f.number, fontSize: 52, lineHeight: 58, color: c.ink, fontVariant: ['tabular-nums'],
                    borderBottomWidth: 2, borderStyle: focused ? 'solid' : 'dashed', borderBottomColor: focused ? c.ember : c.lineStrong,
                  }}
                />
                <Text style={{ fontFamily: f.sans, fontSize: 16, color: c.inkMuted }}>°{unit}</Text>
              </Pressable>
              <RoundButton icon="plus" label="Raise the temperature" onPress={() => nudge(1)} disabled={tempF >= mode.maxF} size={48} />
            </View>
          </View>
          <View>
            <Slider
              value={tempF}
              min={mode.minF}
              max={mode.maxF}
              step={STEP_F}
              onChange={(v) => { setTyped(null); setTempF(v); }}
              accessibilityLabel={`Temperature in °${unit}`}
              valueText={`${shown}°${unit}`}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 }}>
              <T v="small" muted>{lo}°</T>
              <T v="small" muted>{hi}°</T>
            </View>
          </View>
          <T v="small" muted style={{ textAlign: 'center' }}>{mode.hint}</T>
        </View>

        {timer}
      </Screen>
    </>
  );
}

// --- July -------------------------------------------------------------------------

function JulyCook({ modeId, pick, tempF, shown, nudge, unit, busy, error, onStart, timer }: {
  modeId: string; pick: (id: string) => void; tempF: number; shown: number; nudge: (d: 1 | -1) => void; unit: 'F' | 'C';
  busy: boolean; error: string | null; onStart: () => void; timer: React.ReactNode;
}) {
  const { c, f, r } = useTheme();
  const mode = MODES.find((m) => m.id === modeId)!;
  return (
    <Screen
      footer={
        <>
          {error ? <Notice tone="warning" title="The oven didn't start">{error}</Notice> : null}
          <Button variant="primary" icon="flame" busy={busy} onPress={onStart}>{`Preheat to ${shown}°${unit}`}</Button>
          <T v="small" muted style={{ textAlign: 'center' }}>The oven lets you know when it’s hot.</T>
        </>
      }
    >
      <View style={{ gap: space[3] }}>
        <SectionLabel>Cook mode</SectionLabel>
        <View style={styles.grid}>
          {MODES.map((m) => {
            const on = m.id === modeId;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${m.label}. ${m.hint}`}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); pick(m.id); }}
                style={({ pressed }) => [
                  styles.tile,
                  { borderRadius: r.md, borderColor: on ? c.ember : c.line, backgroundColor: on ? c.emberSoft : pressed ? c.surfaceSunken : c.surfaceRaised },
                  on && { borderWidth: 2 },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: f.sansStrong, fontSize: 18, color: on ? c.ember : c.ink }}>{m.label}</Text>
                  {on ? <Icon name="check-circle" size={20} color={c.ember} /> : null}
                </View>
                <Text style={{ fontFamily: f.sans, fontSize: 15, lineHeight: 20, color: c.inkMuted }} numberOfLines={2}>{m.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Temperature</SectionLabel>
        <View style={[styles.julyTemp, { borderRadius: r.lg, backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
          <RoundButton icon="minus" label="Lower by 5 degrees" onPress={() => nudge(-1)} disabled={tempF <= mode.minF} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: f.number, fontSize: 64, lineHeight: 70, color: c.ink, fontVariant: ['tabular-nums'] }}>
              {shown}°
            </Text>
            <T v="small" muted>{unit === 'F' ? `Fahrenheit · ${Math.round(fToC(tempF))}°C` : `Celsius · ${Math.round(cToF(fToC(tempF)))}°F`}</T>
          </View>
          <RoundButton icon="plus" label="Raise by 5 degrees" onPress={() => nudge(1)} disabled={tempF >= mode.maxF} />
        </View>
      </View>

      {timer}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 88, padding: space[4], borderWidth: 1, gap: space[1] },
  tempBox: { padding: space[5], borderWidth: 1, overflow: 'hidden', gap: space[3] },
  julyTemp: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[5], borderWidth: 1 },
});
