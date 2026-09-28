import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { OvenError } from '@/api/client';
import { MODES, cToF, fToC } from '@/api/modes';
import { Icon } from '@/components/Icon';
import { Button, Chip, Notice, RoundButton, Screen, SectionLabel, T } from '@/components/ui';
import { useOven } from '@/state/oven';
import { fonts, radius, space, useTheme } from '@/theme';

const TIMERS = [0, 10, 15, 20, 30, 45, 60, 90];

export default function Cook() {
  const { c } = useTheme();
  const { link, prefs } = useOven();
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

  return (
    <Screen
      footer={
        <>
          {error ? <Notice tone="warning" title="The oven didn't start">{error}</Notice> : null}
          <Button variant="primary" icon="flame" busy={busy} onPress={start}>
            {`Preheat to ${shown}°${unit}`}
          </Button>
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
                  { borderColor: on ? c.ember : c.line, backgroundColor: on ? c.emberSoft : pressed ? c.surfaceSunken : c.surfaceRaised },
                  on && { borderWidth: 2 },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.sansStrong, fontSize: 18, color: on ? c.ember : c.ink }}>{m.label}</Text>
                  {on ? <Icon name="check-circle" size={20} color={c.ember} /> : null}
                </View>
                <Text style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 20, color: c.inkMuted }} numberOfLines={2}>{m.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Temperature</SectionLabel>
        <View style={[styles.tempBox, { backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
          <RoundButton icon="minus" label="Lower by 5 degrees" onPress={() => nudge(-1)} disabled={tempF <= mode.minF} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              accessibilityLiveRegion="polite"
              style={{ fontFamily: fonts.display, fontSize: 64, lineHeight: 70, color: c.ink, fontVariant: ['tabular-nums'] }}
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
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 88, padding: space[4], borderRadius: radius.md, borderWidth: 1, gap: space[1] },
  tempBox: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[5], borderRadius: radius.lg, borderWidth: 1 },
});
