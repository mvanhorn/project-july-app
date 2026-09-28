import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OvenError } from '@/api/client';
import { MODES, fToC, show, formatDuration } from '@/api/modes';
import { Icon, JulyMark, type IconName } from '@/components/Icon';
import { OvenHero, remainingNow, useNow } from '@/components/OvenHero';
import { Button, Card, Chip, IconButton, Notice, RoundButton, Screen, SectionLabel, T, confirm } from '@/components/ui';
import { useOven, useOvenName } from '@/state/oven';
import { fonts, space, type, useTheme } from '@/theme';

export default function Home() {
  const { ready, link } = useOven();
  const { c } = useTheme();
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}><ActivityIndicator color={c.ember} /></View>;
  }
  return link ? <Dashboard /> : <Welcome />;
}

// --- Welcome -----------------------------------------------------------------

function Welcome() {
  const { c } = useTheme();
  const { startDemo } = useOven();
  const insets = useSafeAreaInsets();
  const points: [IconName, string, string][] = [
    ['house', 'Stays at home', 'Your oven, phone and camera talk only on your own Wi-Fi.'],
    ['thermometer', 'Full control', 'Preheat, change the temperature, set timers and stop a cook.'],
    ['camera', 'Live camera', 'Watch the food cook from the sofa. No picture ever leaves the house.'],
  ];
  return (
    <Screen
      footer={
        <>
          <Button variant="primary" onPress={() => router.push('/setup')}>Set up this phone</Button>
          <Button variant="quiet" onPress={startDemo}>Try the demo first</Button>
        </>
      }
    >
      <View style={{ paddingTop: insets.top + space[8], gap: space[5] }}>
        <View style={[styles.markDisc, { backgroundColor: c.emberSoft }]}>
          <JulyMark size={52} color={c.ember} />
        </View>
        <Text accessibilityRole="header" style={[type.hero, { color: c.ink, fontSize: 48, lineHeight: 54 }]}>
          Your oven keeps working.
        </Text>
        <T v="lead" muted>July Oven connects this phone to your June oven over your home network. No cloud, no subscription.</T>
      </View>
      <View style={{ gap: space[5] }}>
        {points.map(([icon, title, body]) => (
          <View key={title} style={{ flexDirection: 'row', gap: space[4] }}>
            <View style={[styles.pointIcon, { backgroundColor: c.surfaceSunken }]}>
              <Icon name={icon} color={c.ember} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodyStrong">{title}</T>
              <T muted>{body}</T>
            </View>
          </View>
        ))}
      </View>
      <T v="small" muted>A community project. Not made by, or affiliated with, June or Weber.</T>
    </Screen>
  );
}

// --- Dashboard ---------------------------------------------------------------

function Dashboard() {
  const { c } = useTheme();
  const { link, snap: s, prefs, paired } = useOven();
  const name = useOvenName();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissedDone, setDismissedDone] = useState(false);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unit = prefs.unit;

  // A new cook re-arms the "finished" notice (state adjusted during render, not in an effect).
  const [wasActive, setWasActive] = useState(s.active);
  if (s.active !== wasActive) {
    setWasActive(s.active);
    if (s.active) setDismissedDone(false);
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof OvenError ? e.message : 'Something went wrong. Try again.');
      if (errTimer.current) clearTimeout(errTimer.current);
      errTimer.current = setTimeout(() => setError(null), 8000);
    } finally {
      setBusy(null);
    }
  }

  const offline = s.link === 'offline' || s.ovenOnline === false;

  return (
    <Screen>
      <View style={[styles.topBar, { paddingTop: insets.top + space[2] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <JulyMark size={28} color={c.ember} />
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: c.ink }}>July Oven</Text>
          {link?.demo ? (
            <View style={[styles.demoTag, { backgroundColor: c.heatSoft }]}>
              <Text style={[type.label, { color: c.heat }]}>Demo</Text>
            </View>
          ) : null}
        </View>
        <IconButton icon="gear" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={{ gap: space[1], marginTop: -space[2] }}>
        <Text accessibilityRole="header" style={[type.title, { color: c.ink }]}>{name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name={offline ? 'alert' : 'house'} size={18} color={offline ? c.fault : c.inkMuted} />
          <T v="small" muted>
            {link?.demo ? 'Simulated — nothing is sent to an oven'
              : s.link === 'connecting' ? 'Connecting on your home network…'
              : offline ? 'Not connected'
              : `Connected at home · ${paired?.conn.host}`}
          </T>
        </View>
      </View>

      {offline && !link?.demo ? (
        <Notice tone="warning" title="Can't reach the oven">
          Check that this phone is on your home Wi-Fi and the oven is switched on. The app keeps trying on its own.
        </Notice>
      ) : null}

      <OvenHero s={s} unit={unit} demo={!!link?.demo} onCamera={() => router.push('/camera')} />

      {error ? <Notice tone="warning" title="That didn't work">{error}</Notice> : null}

      {s.offer ? (
        <Notice tone="info" title={s.offer.type === 'keep_longer' ? 'The oven suggests a little longer' : 'The oven thinks it may be done early'}>
          {`About ${Math.round(s.offer.durationMs / 60000)} min ${s.offer.type === 'keep_longer' ? 'more' : 'less'}.`}
        </Notice>
      ) : null}
      {s.offer ? (
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Button style={{ flex: 1 }} onPress={() => run('offer', () => link!.respondToOffer(true))}>Accept</Button>
          <Button style={{ flex: 1 }} variant="quiet" onPress={() => run('offer', () => link!.respondToOffer(false))}>No thanks</Button>
        </View>
      ) : null}

      {s.phase === 'done' && !dismissedDone ? (
        <Notice tone="success" title="Cooking finished">The oven has switched off its heat and is cooling down.</Notice>
      ) : null}

      {s.active ? (
        <ActiveControls s={s} unit={unit} busy={busy} run={run} />
      ) : (
        <IdleControls disabled={offline && !link?.demo} onDismissDone={() => setDismissedDone(true)} showDismiss={s.phase === 'done' && !dismissedDone} />
      )}
    </Screen>
  );
}

function IdleControls({ disabled, onDismissDone, showDismiss }: { disabled: boolean; onDismissDone: () => void; showDismiss: boolean }) {
  const { prefs } = useOven();
  const quick = MODES.slice(0, 3);
  return (
    <View style={{ gap: space[4] }}>
      <Button variant="primary" icon="flame" disabled={disabled} onPress={() => { onDismissDone(); router.push('/cook'); }}>
        Start cooking
      </Button>
      <SectionLabel>Quick start</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {quick.map((m) => (
          <Chip key={m.id} onPress={() => router.push({ pathname: '/cook', params: { mode: m.id } })}>
            {`${m.label} ${prefs.unit === 'F' ? m.defaultF : Math.round(fToC(m.defaultF) / 5) * 5}°`}
          </Chip>
        ))}
      </View>
      {showDismiss ? <Button variant="quiet" onPress={onDismissDone}>Dismiss</Button> : null}
    </View>
  );
}

function ActiveControls({ s, unit, busy, run }: {
  s: ReturnType<typeof useOven>['snap']; unit: 'F' | 'C'; busy: string | null;
  run: (key: string, fn: () => Promise<void>) => Promise<void>;
}) {
  const { c } = useTheme();
  const { link } = useOven();
  const step = unit === 'F' ? 5 : 5 * (5 / 9);
  const [pendingC, setPendingC] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownTarget = pendingC ?? s.targetC;
  const now = useNow(s.remainingMs !== null);
  const left = remainingNow(s, now);

  function nudge(dir: 1 | -1) {
    if (shownTarget === null) return;
    const lo = fToC(100), hi = fToC(450);
    const next = Math.min(hi, Math.max(lo, shownTarget + dir * step));
    setPendingC(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      run('temp', () => link!.setTemperature(next)).finally(() => setPendingC(null));
    }, 900);
  }

  const addTimer = (min: number) => run('timer', () => link!.setTimer((left ?? 0) + min * 60_000));

  return (
    <View style={{ gap: space[4] }}>
      <Card>
        <View style={{ gap: space[3] }}>
          <SectionLabel>Target temperature</SectionLabel>
          <View style={styles.stepper}>
            <RoundButton icon="minus" label={`Lower by 5 degrees`} onPress={() => nudge(-1)} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 48, lineHeight: 54, color: c.ink, fontVariant: ['tabular-nums'] }}>
                {show(shownTarget, unit)}°
              </Text>
              <T v="small" muted>{busy === 'temp' ? 'Sending to the oven…' : pendingC !== null ? 'Setting…' : unit === 'F' ? 'Fahrenheit' : 'Celsius'}</T>
            </View>
            <RoundButton icon="plus" label={`Raise by 5 degrees`} onPress={() => nudge(1)} />
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: space[3] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>Timer</SectionLabel>
            {left !== null ? <T v="bodyStrong">{formatDuration(left)} left</T> : <T v="small" muted>Not set</T>}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {(left !== null ? [1, 5, 10] : [10, 20, 30, 45]).map((m) => (
              <Chip key={m} onPress={() => addTimer(m)} accessibilityLabel={left !== null ? `Add ${m} minutes` : `Set ${m} minute timer`}>
                {left !== null ? `+${m} min` : `${m} min`}
              </Chip>
            ))}
          </View>
        </View>
      </Card>

      <Button
        icon="stop"
        busy={busy === 'cancel'}
        onPress={async () => {
          if (await confirm('Stop cooking?', 'The oven will turn off its heat.', 'Stop cooking')) run('cancel', () => link!.cancel());
        }}
      >
        Stop cooking
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  markDisc: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  pointIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  demoTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: space[1] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
});
