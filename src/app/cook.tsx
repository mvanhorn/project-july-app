import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { OvenError } from '@/api/client';
import { MODES, cToF, fToC, formatDuration } from '@/api/modes';
import { GlassFill, ModeTile } from '@/components/glass';
import { Icon } from '@/components/Icon';
import { useNow } from '@/components/OvenHero';
import { Button, Chip, Notice, RoundButton, Screen, SectionLabel, T } from '@/components/ui';
import { useOven } from '@/state/oven';
import { space, useTheme } from '@/theme';

const TIMERS = [0, 10, 15, 20, 30, 45, 60, 90];
// Glass: the review closes itself after 5 minutes (the UL 1026 remote-programming
// window), so nothing can start from a screen left open on the counter.
const REVIEW_MS = 5 * 60_000;

export default function Cook() {
  const { c, f, r, look } = useTheme();
  const { link, prefs } = useOven();
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
  const [gridW, setGridW] = useState(340);
  const [openedAt] = useState(() => Date.now());
  const now = useNow(glass);
  const closesIn = Math.max(0, REVIEW_MS - (now - openedAt));

  useEffect(() => {
    if (!glass) return;
    const t = setTimeout(() => { if (router.canGoBack()) router.back(); }, REVIEW_MS);
    return () => clearTimeout(t);
  }, [glass]);

  const shown = unit === 'F' ? tempF : Math.round(fToC(tempF));
  const pick = (id: string) => {
    const m = MODES.find((x) => x.id === id)!;
    setModeId(id);
    setTempF(m.defaultF);
  };
  const nudge = (d: 1 | -1) => setTempF((t) => Math.min(mode.maxF, Math.max(mode.minF, t + d * 5)));

  async function start() {
    if (!link) return;
    setBusy(true);
    setError(null);
    try {
      await link.preheat(mode.id, fToC(tempF));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (timerMin) await link.setTimer(timerMin * 60_000).catch(() => {});
      router.back();
    } catch (e) {
      setError(e instanceof OvenError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const tile = Math.max(48, Math.min(Math.floor((gridW - 2 * 16) / 3), 96));

  return (
    <Screen
      footer={
        <>
          {error ? <Notice tone="warning" title="The oven didn't start">{error}</Notice> : null}
          {glass ? (
            <T v="small" muted style={{ textAlign: 'center' }}>Make sure the oven is empty and the door is closed.</T>
          ) : null}
          <Button variant="primary" icon={glass ? undefined : 'flame'} busy={busy} onPress={start}>
            {glass ? `Start preheating to ${shown}°` : `Preheat to ${shown}°${unit}`}
          </Button>
          <T v="small" muted style={{ textAlign: 'center' }}>
            {glass ? `This closes in ${formatDuration(closesIn)}` : 'The oven lets you know when it’s hot.'}
          </T>
        </>
      }
    >
      <View style={{ gap: space[3] }}>
        <SectionLabel>Cook mode</SectionLabel>
        {glass ? (
          <View onLayout={(e: LayoutChangeEvent) => { const lw = e.nativeEvent.layout.width; if (lw >= 200) setGridW(lw); }}>
            <View accessibilityRole="radiogroup" style={{ width: tile * 3 + 32, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: space[3] }}>
              {MODES.map((m) => (
                <ModeTile key={m.id} mode={m.id} label={m.label} size={tile} selected={m.id === modeId} onPress={() => pick(m.id)} accessibilityLabel={`${m.label}. ${m.hint}`} />
              ))}
            </View>
          </View>
        ) : (
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
        )}
        {glass ? <T v="small" muted style={{ textAlign: 'center' }}>{mode.hint}</T> : null}
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Temperature</SectionLabel>
        <View style={[styles.tempBox, { borderRadius: r.lg, backgroundColor: c.surfaceRaised, borderColor: c.line }, glass && { overflow: 'hidden' }]}>
          {glass ? <GlassFill /> : null}
          <RoundButton icon="minus" label="Lower by 5 degrees" onPress={() => nudge(-1)} disabled={tempF <= mode.minF} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              accessibilityLiveRegion="polite"
              style={{ fontFamily: f.number, fontSize: glass ? 72 : 64, lineHeight: glass ? 74 : 70, color: c.ink, fontVariant: ['tabular-nums'] }}
            >
              {shown}°
            </Text>
            <T v="small" muted>{unit === 'F' ? `Fahrenheit · ${Math.round(fToC(tempF))}°C` : `Celsius · ${Math.round(cToF(fToC(tempF)))}°F`}</T>
          </View>
          <RoundButton icon="plus" label="Raise by 5 degrees" onPress={() => nudge(1)} disabled={tempF >= mode.maxF} />
        </View>
      </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 88, padding: space[4], borderWidth: 1, gap: space[1] },
  tempBox: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[5], borderWidth: 1 },
});
