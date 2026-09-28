import { View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { urls } from '@/api/endpoint';
import { Button, Card, Divider, Notice, Row, Screen, SectionLabel, Segmented, T, confirm } from '@/components/ui';
import { useOven, useOvenName } from '@/state/oven';
import { space, useTheme } from '@/theme';

export default function Settings() {
  const { c } = useTheme();
  const { paired, link, prefs, setUnit, forget } = useOven();
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

      {paired ? (
        <View style={{ gap: space[3] }}>
          <SectionLabel>Connection</SectionLabel>
          <Card padded={false}>
            <Row icon="wifi" label="Address" value={paired.conn.host} mono />
            <Divider />
            <Row icon="house" label="Link" value={paired.conn.secure ? 'Secure (HTTPS)' : 'Local port 8080'} />
            <Divider />
            <Row icon="link" label="Server status page" onPress={() => WebBrowser.openBrowserAsync(urls(paired.conn).statusPage)} />
          </Card>
          {!paired.conn.secure ? (
            <Notice tone="info" title="Using the local port">
              Commands are signed by this phone, so the oven only obeys you. To also encrypt the connection, install your home’s certificate (ca.crt) on this phone and pair again.
            </Notice>
          ) : null}
        </View>
      ) : null}

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
        <SectionLabel>About</SectionLabel>
        <T muted>
          July Oven is a community project that keeps June ovens working after the June cloud shut down. It is not made by, or affiliated with, June or Weber.
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
