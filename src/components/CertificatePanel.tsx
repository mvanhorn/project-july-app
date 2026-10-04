// The oven's home certificate, for setup and Settings: give the app the home CA
// (ca.crt, picked or pasted), or opt in to connecting without checking. See
// src/api/trust.ts.
import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { File } from 'expo-file-system';
import { hasTrust, readCa, shortFingerprint, tlsAvailable, type Trust } from '@/api/trust';
import { space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Button, Field, Notice, T } from './ui';

export function CertificatePanel({ trust, onChange, startOpen }: { trust: Trust; onChange: (t: Trust) => void; startOpen?: boolean }) {
  const { c, f, r } = useTheme();
  const [open, setOpen] = useState(startOpen ?? hasTrust(trust));
  const [pasting, setPasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ca = useMemo(() => {
    const got = trust.caPem ? readCa(trust.caPem) : null;
    return got && !('error' in got) ? got : null;
  }, [trust.caPem]);

  function take(input: string | Uint8Array) {
    const got = readCa(input);
    if ('error' in got) { setError(got.error); return; }
    setError(null);
    setPasting(false);
    onChange({ ...trust, caPem: got.pem });
  }

  async function choose() {
    try {
      const picked = await File.pickFileAsync();
      if (picked.canceled) return;
      take(await picked.result.bytes());
    } catch {
      setError('That file couldn’t be opened.');
    }
  }

  const summary = ca ? `Using ${ca.name ?? 'your ca.crt'}` : 'Optional';
  return (
    <View style={{ gap: space[3] }}>
      {/* Always in view: the opt-in to skip checks, with what it means when it's on. */}
      <View style={{ gap: space[3], padding: space[4], borderWidth: 1, borderRadius: r.md, borderColor: trust.insecure ? c.heat : c.line, backgroundColor: c.surfaceRaised }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: f.sansStrong, fontSize: 16, color: c.ink }}>Connect without checking the certificate</Text>
            <T v="small" muted>{tlsAvailable ? 'Off unless you turn it on. Adding your ca.crt is safer.' : 'Needs an installed build of the app.'}</T>
          </View>
          <Switch
            accessibilityLabel="Connect without checking the certificate"
            value={trust.insecure}
            onValueChange={(v) => onChange({ ...trust, insecure: v })}
            trackColor={{ true: c.ember, false: c.lineStrong }}
            thumbColor="#ffffff"
          />
        </View>
        {trust.insecure ? (
          <Notice tone="warning" title="Only on a network you trust">
            {ca
              ? 'With this on, the app connects even if the oven’s certificate doesn’t match your ca.crt. The link is encrypted, but this phone can’t tell your oven from a device pretending to be it. Commands are still signed by this phone.'
              : 'The link is encrypted, but this phone can’t tell your oven from a device pretending to be it. Commands are still signed by this phone. Adding your ca.crt instead is safer.'}
          </Notice>
        ) : null}
      </View>

      <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: r.md, overflow: 'hidden' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingHorizontal: space[4], backgroundColor: pressed ? c.surfaceSunken : c.surfaceRaised })}
        >
          <Icon name="link" color={c.inkMuted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f.sansStrong, fontSize: 16, color: c.ink }}>Home certificate</Text>
            <T v="small" muted>{summary}</T>
          </View>
          <Icon name={open ? 'minus' : 'plus'} size={20} color={c.inkMuted} />
        </Pressable>

        {open ? (
          <View style={{ padding: space[4], gap: space[4], borderTopWidth: 1, borderTopColor: c.line }}>
            <T v="small" muted>
              Only if your oven uses its own home certificate (ca.crt, from the installer) and this phone doesn’t trust it. Without one, the app uses the oven’s plain port, and commands are still signed by this phone.
            </T>
            {!tlsAvailable ? (
              <Notice tone="info" title="Needs the full app">
                Expo Go and the web preview can’t change how certificates are checked. These work in an installed build of the app.
              </Notice>
            ) : null}

            {ca ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Icon name="check-circle" color={c.ready} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: f.sansStrong, fontSize: 16, color: c.ink }}>{ca.name ?? 'Home certificate'}</Text>
                  <Text style={{ fontFamily: f.mono, fontSize: 12, color: c.inkMuted }}>{`SHA-256 ${shortFingerprint(ca.sha256)}`}</Text>
                </View>
                <Button variant="quiet" onPress={() => onChange({ ...trust, caPem: null })}>Remove</Button>
              </View>
            ) : (
              <View style={{ gap: space[3] }}>
                <View style={{ flexDirection: 'row', gap: space[3] }}>
                  <Button style={{ flex: 1 }} onPress={choose}>Choose ca.crt</Button>
                  <Button style={{ flex: 1 }} onPress={() => setPasting((p) => !p)}>{pasting ? 'Cancel' : 'Paste it'}</Button>
                </View>
                {pasting ? (
                  <Field
                    label="Paste the certificate"
                    placeholder="-----BEGIN CERTIFICATE-----"
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(v) => { if (v.includes('-----END CERTIFICATE-----')) take(v); }}
                    style={{ fontFamily: f.mono, fontSize: 12, minHeight: 120, textAlignVertical: 'top', paddingVertical: space[3] }}
                  />
                ) : null}
              </View>
            )}
            {error ? <T v="small" color={c.fault}>{error}</T> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
