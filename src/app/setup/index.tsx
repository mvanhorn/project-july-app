import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, type TextInput } from 'react-native';
import { router } from 'expo-router';
import { networkPrefix, scan, type Found } from '@/api/discover';
import { normalizeHost, probe, type ProbeResult } from '@/api/endpoint';
import { NO_TRUST, hasTrust, type Trust } from '@/api/trust';
import { CertificatePanel } from '@/components/CertificatePanel';
import { Icon } from '@/components/Icon';
import { Button, Field, Notice, ProgressBar, Screen, SetupStep, T } from '@/components/ui';
import { useOven } from '@/state/oven';
import { space, useTheme } from '@/theme';

// Until the network is known: most home routers hand out 192.168.1.x.
const DEFAULT_PREFIX = '192.168.1';

type Search =
  | { phase: 'starting' }
  | { phase: 'scanning' | 'done'; prefix: string; done: number; total: number; found: Found[] }
  | { phase: 'no-network' };

export default function Setup() {
  const { c, f, t } = useTheme();
  const { ovens, startDemo, setHostTrust } = useOven();
  // Adding a second (or third) oven: names by host of the ovens already paired.
  const pairedAt = new Map(ovens.flatMap((o) => (o.paired ? [[o.paired.conn.host, o.name] as const] : [])));
  const adding = pairedAt.size > 0;
  const lastPhoneName = ovens.find((o) => o.paired)?.paired?.deviceName;
  const [host, setHost] = useState(`${DEFAULT_PREFIX}.`);
  const [phoneName, setPhoneName] = useState(lastPhoneName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android phone'));
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [search, setSearch] = useState<Search>({ phase: 'starting' });
  const [searchRun, setSearchRun] = useState(0);
  const [trust, setTrust] = useState<Trust>(NO_TRUST);
  const clean = normalizeHost(host);
  const complete = clean !== '' && !clean.endsWith('.');
  const hostRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  // Once someone types an address, the search no longer fills it in.
  const typed = useRef(false);
  // The search fills in the first oven it finds that isn't paired yet.
  const autoPicked = useRef(false);
  const pairedRef = useRef(pairedAt);
  useEffect(() => { pairedRef.current = pairedAt; });
  const trustRef = useRef(trust);
  useEffect(() => { trustRef.current = trust; }, [trust]);

  async function check(target = clean) {
    setChecking(true);
    setResult(null);
    // The certificate choice applies before the first HTTPS request. An oven already
    // paired keeps the trust it has unless a certificate was chosen here.
    if (hasTrust(trustRef.current)) setHostTrust(target, trustRef.current);
    else if (!pairedRef.current.has(target)) setHostTrust(target, null);
    setResult(await probe(target));
    setChecking(false);
  }

  // Look for june-local on this phone's network while the screen is open.
  useEffect(() => {
    const stop = new AbortController();
    (async () => {
      const prefix = await networkPrefix();
      if (stop.signal.aborted) return;
      if (!prefix) { setSearch({ phase: 'no-network' }); return; }
      if (!typed.current) setHost((h) => (h === `${DEFAULT_PREFIX}.` ? `${prefix}.` : h));
      const found: Found[] = [];
      setSearch({ phase: 'scanning', prefix, done: 0, total: 254, found });
      await scan(prefix, {
        signal: stop.signal,
        onProgress: (done, total) => setSearch((s) => (s.phase === 'scanning' ? { ...s, done, total } : s)),
        onFound: (hit) => {
          found.push(hit);
          setSearch((s) => (s.phase === 'scanning' ? { ...s, found: [...found] } : s));
          if (!autoPicked.current && !typed.current && !pairedRef.current.has(hit.host)) {
            autoPicked.current = true;
            setHost(hit.host);
            check(hit.host);
          }
        },
      });
      if (!stop.signal.aborted) setSearch((s) => (s.phase === 'scanning' ? { ...s, phase: 'done' } : s));
    })();
    return () => stop.abort();
    // check is recreated each render; the search only needs to start once per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchRun]);

  const found = result?.ok === true;
  const pick = (h: string) => { typed.current = true; setHost(h); check(h); };

  return (
    <Screen
      footer={
        found ? (
          <>
            <Button
              variant="primary"
              onPress={() => router.push({
                pathname: '/setup/pair',
                params: { host: clean, secure: result.secure ? '1' : '0', port: result.httpPort ? String(result.httpPort) : '', name: phoneName.trim() || 'Phone' },
              })}
            >
              Continue to pairing
            </Button>
            <Button variant="quiet" onPress={() => check()}>Check again</Button>
          </>
        ) : (
          <Button variant="primary" icon="wifi" busy={checking} disabled={!complete} onPress={() => check()}>
            Find my oven
          </Button>
        )
      }
    >
      <View style={{ gap: space[2] }}>
        <Text accessibilityRole="header" style={[t.title, { color: c.ink }]}>{adding ? 'Add another oven' : 'Connect to your oven'}</Text>
        <T v="lead" muted>This takes about two minutes. Stand near the oven, as you’ll type a code on its screen.</T>
      </View>

      <View style={{ gap: space[5] }}>
        <SetupStep n={1} title="Join your home Wi-Fi" done={found}>
          This phone needs to be on the same network as the oven.
        </SetupStep>
        <SetupStep n={2} title="Find the oven" done={found}>
          The app looks for it on your network. You can also type its address: it is in your router’s list of devices, and looks like 192.168.1.75.
        </SetupStep>
      </View>

      <SearchPanel search={search} current={clean} paired={pairedAt} onPick={pick} onAgain={() => setSearchRun((n) => n + 1)} />

      <Field
        ref={hostRef}
        label="Oven address"
        hint="An IP address, or june.local unless your installer chose another name"
        placeholder="192.168.1.75"
        value={host}
        onChangeText={(v) => { typed.current = true; setHost(v); setResult(null); }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'url'}
        // Start at the end of the prefilled network (setSelection is native only).
        onFocus={() => hostRef.current?.setSelection?.(host.length, host.length)}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => nameRef.current?.focus()}
        style={{ fontFamily: f.mono, fontSize: 20 }}
      />
      <Field
        label="Name for this phone"
        hint="The oven lists paired phones by this name."
        value={phoneName}
        ref={nameRef}
        onChangeText={setPhoneName}
        maxLength={40}
        returnKeyType="go"
        onSubmitEditing={() => (complete ? check() : hostRef.current?.focus())}
      />

      <CertificatePanel trust={trust} onChange={(next) => { setTrust(next); setResult(null); }} />

      {result?.ok && result.secure ? (
        <Notice tone="success" title="Found your oven">
          {trust.insecure && !trust.caPem
            ? 'Encrypted connection to june-local. Its certificate isn’t checked, as you chose. You’re ready to pair.'
            : trust.caPem
              ? 'Secure connection to june-local, checked against your ca.crt. You’re ready to pair.'
              : 'Secure connection to june-local on your oven. You’re ready to pair.'}
        </Notice>
      ) : null}
      {result?.ok && !result.secure ? (
        <Notice tone="info" title={`Found your oven, on the plain port (${result.httpPort})`}>
          {hasTrust(trust)
            ? 'HTTPS didn’t answer, even with your certificate choice, so the app will use the plain port. Commands are still signed by this phone.'
            : 'This phone doesn’t trust your home’s certificate yet, so it will use the oven’s plain port. Commands are still signed by this phone. To encrypt the link as well, add your ca.crt under Home certificate, then check again.'}
        </Notice>
      ) : null}
      {result && !result.ok ? <Notice tone="warning" title="Couldn't find the oven">{result.message}</Notice> : null}
      {complete && pairedAt.has(clean) ? (
        <Notice tone="info" title={`Already paired as ${pairedAt.get(clean)}`}>Pairing again replaces it.</Notice>
      ) : null}

      {adding ? null : <Button variant="quiet" onPress={() => { startDemo(); router.replace('/'); }}>Try the demo instead</Button>}
    </Screen>
  );
}

// --- The network search -----------------------------------------------------------

function SearchPanel({ search, current, paired, onPick, onAgain }: {
  search: Search; current: string;
  /** Names of ovens already paired, by address. */
  paired: Map<string, string>;
  onPick: (host: string) => void; onAgain: () => void;
}) {
  const { c, f, r } = useTheme();
  if (search.phase === 'starting') return null;
  if (search.phase === 'no-network') {
    return <T v="small" muted>This phone couldn’t tell which network it is on, so it can’t look for the oven. Type its address below.</T>;
  }
  const { prefix, done, total, found } = search;
  return (
    <View style={{ gap: space[3] }}>
      {search.phase === 'scanning' ? (
        <View style={{ gap: space[2] }} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <ActivityIndicator size="small" color={c.ember} />
            <T v="small" muted>{`Looking for the oven on ${prefix}.x… ${done} of ${total}`}</T>
          </View>
          <ProgressBar value={done / total} color={c.ember} />
        </View>
      ) : found.length === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <T v="small" muted style={{ flex: 1 }}>{`No oven answered on ${prefix}.x. Type its address below.`}</T>
          <Button variant="quiet" onPress={onAgain}>Search again</Button>
        </View>
      ) : null}
      {found.map((o) => {
        const on = o.host === current;
        return (
          <Pressable
            key={o.host}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Use the oven at ${o.host}`}
            onPress={() => onPick(o.host)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingHorizontal: space[4], borderRadius: r.md,
              borderWidth: on ? 2 : 1, borderColor: on ? c.ember : c.line, backgroundColor: pressed ? c.surfaceSunken : c.surfaceRaised,
            })}
          >
            <Icon name="oven" color={on ? c.ember : c.inkMuted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: f.mono, fontSize: 17, color: c.ink }}>{o.host}</Text>
              <T v="small" muted>{paired.has(o.host) ? `Paired as ${paired.get(o.host)}` : `june-local${o.status.version ? ` ${o.status.version}` : ''}`}</T>
            </View>
            {on ? <Icon name="check-circle" size={22} color={c.ember} /> : <T v="small" color={c.ember}>Use</T>}
          </Pressable>
        );
      })}
      {search.phase === 'done' && found.length > 0 ? (
        <Button variant="quiet" onPress={onAgain}>Search again</Button>
      ) : null}
    </View>
  );
}
