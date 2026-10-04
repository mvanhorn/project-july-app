import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { probe, urls, type ProbeResult } from '@/api/endpoint';
import { PAGE_TILES } from '@/api/modes';
import { NO_TRUST } from '@/api/trust';
import { CertificatePanel } from '@/components/CertificatePanel';
import { Button, Card, Divider, Field, Notice, Row, Screen, SectionLabel, Segmented, T, confirm } from '@/components/ui';
import { CAMERA_FPS, useOven, useOvenName } from '@/state/oven';
import { Icon } from '@/components/Icon';
import { OVEN_ICONS, OvenIcon, mdiName } from '@/components/OvenIcon';
import { space, THEMES, useTheme, useThemeSettings, type ThemeId } from '@/theme';

export default function Settings() {
  const { c, look } = useTheme();
  const { paired, link, prefs, setUnit, setPref, forget } = useOven();
  const glass = look.hero === 'glass';
  const name = useOvenName();
  const demo = !!link?.demo;

  async function unpair() {
    if (demo) { await forget(); router.replace('/'); return; }
    const ok = await confirm(
      'Unpair this phone?',
      `This phone will stop controlling ${name}. You can pair again at any time with a new code.`,
      'Unpair',
    );
    if (!ok) return;
    await forget();
    router.replace('/');
  }

  return (
    <Screen>
      {paired ? (
        <View style={{ gap: space[3] }}>
          <SectionLabel>Oven</SectionLabel>
          <Card padded={false}>
            <Row icon="oven" label="Name" value={paired.oven.name} />
            <Divider />
            <Row label="Model" value={paired.oven.model ?? 'June Oven'} />
            <Divider />
            <Row label="Oven ID" value={paired.oven.id.slice(0, 12) + (paired.oven.id.length > 12 ? '…' : '')} mono />
            <Divider />
            <Row label="Paired" value={new Date(paired.pairedAt).toLocaleDateString()} />
          </Card>
        </View>
      ) : null}

      {paired ? <ConnectionSettings /> : null}

      <View style={{ gap: space[3] }}>
        <SectionLabel>Appearance</SectionLabel>
        <ThemePicker />
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Display</SectionLabel>
        <Segmented
          label="Temperature units"
          value={prefs.unit}
          onChange={setUnit}
          options={[{ value: 'F', label: '°F  Fahrenheit' }, { value: 'C', label: '°C  Celsius' }]}
        />
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Camera frame rate</SectionLabel>
        <Segmented
          label="Camera frame rate"
          value={String(prefs.cameraFps)}
          onChange={(v) => setPref('cameraFps', Number(v))}
          options={CAMERA_FPS.map((v) => ({ value: String(v), label: `${v} fps` }))}
        />
        <T v="small" muted>Pictures per second while the camera is open. 1 fps is the stock June app’s rate; the oven sends about one new picture a second.</T>
      </View>

      {glass ? <HomeScreenSettings /> : null}

      <View style={{ gap: space[3] }}>
        <SectionLabel>About</SectionLabel>
        <T muted>
          Project July is a community project that keeps June ovens working after the June cloud shut down. This phone talks to june-local, a small server that runs on the oven itself. It is not made by, or affiliated with, June or Weber.
        </T>
        <T v="small" muted>Version {Constants.expoConfig?.version ?? '1.0.0'}</T>
      </View>

      {paired || demo ? (
        <Button onPress={unpair} style={{ borderColor: demo ? c.lineStrong : c.fault }}>
          {demo ? 'Leave the demo' : 'Unpair this phone'}
        </Button>
      ) : null}
    </Screen>
  );
}

/** How this phone reaches the paired oven, and the oven's home certificate. */
function ConnectionSettings() {
  const { paired, trusts, setHostTrust, updateConnection } = useOven();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<ProbeResult | null>(null);
  if (!paired) return null;
  const { conn } = paired;
  const trust = trusts[conn.host] ?? NO_TRUST;
  const link = !conn.secure ? `Plain port ${conn.httpPort ?? 8080}`
    : trust.caPem ? 'HTTPS, checked against your ca.crt'
    : trust.insecure ? 'HTTPS, certificate not checked'
    : 'Secure (HTTPS)';

  // After a certificate change: use HTTPS if it now works, or the plain port if not.
  async function recheck() {
    setChecking(true);
    setChecked(null);
    const r = await probe(conn.host);
    setChecked(r);
    if (r.ok) await updateConnection({ host: conn.host, secure: r.secure, httpPort: r.httpPort ?? conn.httpPort });
    setChecking(false);
  }

  return (
    <View style={{ gap: space[3] }}>
      <SectionLabel>Connection</SectionLabel>
      <Card padded={false}>
        <Row icon="wifi" label="Address" value={conn.host} mono />
        <Divider />
        <Row icon="house" label="Link" value={link} />
        <Divider />
        <Row icon="link" label="Server status page" onPress={() => WebBrowser.openBrowserAsync(urls(conn).statusPage)} />
      </Card>
      {!conn.secure ? (
        <Notice tone="info" title="Using the plain port">
          Commands are signed by this phone, so the oven only obeys you. To also encrypt the connection, add your home’s certificate (ca.crt) below, then check the connection.
        </Notice>
      ) : null}
      <CertificatePanel trust={trust} onChange={(t) => { setHostTrust(conn.host, t); setChecked(null); }} />
      <Button busy={checking} onPress={recheck}>Check the connection</Button>
      {checked?.ok ? (
        <Notice tone="success" title={checked.secure ? 'Connected over HTTPS' : `Connected on the plain port (${checked.httpPort})`}>
          {checked.secure ? 'This phone now reaches the oven over an encrypted link.' : 'HTTPS didn’t answer, so the app keeps using the plain port.'}
        </Notice>
      ) : checked ? (
        <Notice tone="warning" title="Couldn't reach the oven">{checked.message}</Notice>
      ) : null}
    </View>
  );
}

/** The Home Assistant card's own settings, for the glass home screen. */
function HomeScreenSettings() {
  const { c, r } = useTheme();
  const { prefs, setPref, resetPrefs } = useOven();
  const name = useOvenName();
  const mdi = prefs.icon.startsWith('mdi:') ? prefs.icon : '';
  const [typed, setTyped] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);

  function commitIcon() {
    if (typed === null) return;
    const v = typed.trim().toLowerCase();
    setTyped(null);
    if (!v) { setIconError(null); setPref('icon', 'oven'); return; }
    const full = v.startsWith('mdi:') ? v : `mdi:${v}`;
    if (mdiName(full)) { setIconError(null); setPref('icon', full); }
    else setIconError(`${full} isn't in the Material Design icon set.`);
  }

  return (
    <>
      <View style={{ gap: space[3] }}>
        <SectionLabel>Oven name</SectionLabel>
        <Segmented
          label="Oven name"
          value={prefs.hideName ? 'tuck' : 'show'}
          onChange={(v) => setPref('hideName', v === 'tuck')}
          options={[{ value: 'tuck', label: 'Tuck into the icon' }, { value: 'show', label: 'Always show' }]}
        />
        <T v="small" muted>On the home screen the name tucks into the oven’s icon after 5 seconds. Tap the icon to see it.</T>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Cook modes</SectionLabel>
        <Segmented
          label="Cook mode order"
          value={prefs.modeOrder}
          onChange={(v) => setPref('modeOrder', v)}
          options={[{ value: 'oven', label: 'Oven’s order' }, { value: 'used', label: 'Most used first' }]}
        />
        <T v="small" muted>Most used first counts the cooks started from this phone.</T>
        <Segmented
          label="Cook modes on the home screen"
          value={prefs.modesShown}
          onChange={(v) => setPref('modesShown', v)}
          options={[{ value: 'pages', label: 'Pages' }, { value: 'all', label: 'All on one' }]}
        />
        <T v="small" muted>{`Pages: ${PAGE_TILES} tiles to a page in this order, swiping for the rest, with Camera and Settings on the last page.`}</T>
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Clock</SectionLabel>
        <Segmented
          label="Clock"
          value={prefs.clock}
          onChange={(v) => setPref('clock', v)}
          options={[{ value: 'auto', label: 'Automatic' }, { value: '12', label: '12-hour' }, { value: '24', label: '24-hour' }]}
        />
      </View>

      <View style={{ gap: space[3] }}>
        <SectionLabel>Oven icon</SectionLabel>
        <View accessibilityRole="radiogroup" accessibilityLabel={`Icon for ${name}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {Object.entries(OVEN_ICONS).map(([id, [label]]) => {
            const on = prefs.icon === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={label}
                onPress={() => { setIconError(null); setPref('icon', id); }}
                style={({ pressed }) => [styles.icon, {
                  borderRadius: r.sm, borderColor: on ? c.ember : c.lineStrong, borderWidth: on ? 1.5 : 1,
                  backgroundColor: on ? c.emberSoft : pressed ? c.surfaceSunken : 'transparent',
                }]}
              >
                <OvenIcon icon={id} size={24} color={c.ink} />
              </Pressable>
            );
          })}
        </View>
        <Field
          label="Or any Material Design icon"
          placeholder="mdi:stove"
          value={typed ?? mdi}
          onChangeText={setTyped}
          onBlur={commitIcon}
          onSubmitEditing={commitIcon}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          error={iconError ?? undefined}
          hint={mdi ? undefined : 'Such as mdi:stove or mdi:silverware-fork-knife.'}
        />
      </View>

      <Button variant="quiet" onPress={() => { setTyped(null); setIconError(null); resetPrefs(); }}>Reset the home screen</Button>
    </>
  );
}

/** One preview swatch per theme, each drawn in its own colours and fonts. */
function ThemePicker() {
  const { name, c, f, r } = useTheme();
  const { themeId, setThemeId, appearance, setAppearance } = useThemeSettings();
  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const def = THEMES[id];
          const p = def.palette[name];
          const tf = def.fonts[name];
          const on = id === themeId;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${def.label} theme. ${def.description}`}
              onPress={() => setThemeId(id)}
              style={[styles.choice, { borderRadius: r.lg, borderColor: on ? c.ember : c.line, borderWidth: on ? 2.5 : 1 }]}
            >
              <View style={[styles.swatch, { backgroundColor: p.cardBottom, borderRadius: def.radius.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.ember }} />
                  <Text style={{ fontFamily: tf.sansStrong, fontSize: 11, letterSpacing: 0.8, color: p.ink }}>COOKING</Text>
                </View>
                <Text style={{ fontFamily: tf.number, fontSize: 40, lineHeight: 44, color: p.ink }}>350°</Text>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: p.line }}>
                  <View style={{ width: '65%', height: '100%', borderRadius: 3, backgroundColor: p.ember }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <View style={{ flex: 1, height: 22, borderRadius: def.radius.sm, backgroundColor: id === 'glass' ? p.stop : p.ember }} />
                  <View style={{ flex: 1, height: 22, borderRadius: def.radius.sm, borderWidth: 1, borderColor: p.lineStrong }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: f.sansStrong, fontSize: 17, color: c.ink }}>{def.label}</Text>
                {on ? <Icon name="check-circle" size={22} color={c.ember} /> : null}
              </View>
              <Text style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 19, color: c.inkMuted }}>{def.description}</Text>
            </Pressable>
          );
        })}
      </View>
      <Segmented
        label="Light or dark"
        value={appearance}
        onChange={setAppearance}
        options={[{ value: 'system', label: 'Match phone' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { flex: 1, padding: space[3], gap: space[2] },
  swatch: { padding: space[3], gap: 4 },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
