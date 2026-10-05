// Live view, full screen: the oven's camera on black, with Close, Save and Share.
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { show } from '@/api/modes';
import { canShare, usePictureActions } from '@/components/cameraShot';
import { PictureButton, PictureMessage } from '@/components/CameraTile';
import { Icon, type IconName } from '@/components/Icon';
import { useNow } from '@/components/OvenHero';
import { useCameraFeed } from '@/components/useCameraFeed';
import { useOven, useOvenName } from '@/state/oven';
import { useTheme } from '@/theme';

const DEMO_IMAGE = require('../../assets/demo-camera.jpg');

export default function Camera() {
  const { f } = useTheme();
  const { link, snap: s, prefs } = useOven();
  const name = useOvenName();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useNow(true, 1000);

  // Watch the camera while this screen is open.
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const src = useCameraFeed(focused);
  const shot = usePictureActions(src, name);

  const demo = !!link?.demo;
  const at = demo ? s.imageAt : shownAt;
  const age = at ? Math.round((now - at) / 1000) : null;
  const live = age !== null && age < 5;
  const source = demo ? DEMO_IMAGE : src ? { uri: src } : null;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={0}
          cachePolicy="none"
          onLoad={() => { setShownAt(Date.now()); setFailed(false); }}
          onError={() => setFailed(true)}
          accessibilityLabel={`Live picture from inside ${name}`}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {age === null ? (
        <View style={styles.waiting}>
          <Icon name="camera" size={36} color="#a1a1aa" />
          <Text style={{ fontFamily: f.sansMedium, fontSize: 17, color: '#d4d4d8' }}>{failed ? 'No picture yet' : 'Waking the camera…'}</Text>
          {failed && !demo ? (
            <Text style={{ fontFamily: f.sans, fontSize: 15, color: '#a1a1aa', textAlign: 'center' }}>
              If it stays dark, check the camera service on the oven.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <PictureButton icon="close" label="Close full screen" onPress={close} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: f.sansStrong, fontSize: 18, color: '#fff' }}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.dot, { backgroundColor: live ? '#ef4444' : '#71717a' }]} />
            <Text style={{ fontFamily: f.sansStrong, fontSize: 13, letterSpacing: 0.8, color: live ? '#fff' : '#fbbf24' }}>
              {live ? 'LIVE' : age === null ? 'WAITING' : `${age} s AGO`}
            </Text>
            {s.cavityC !== null ? (
              <Text style={{ fontFamily: f.sans, fontSize: 14, color: '#d4d4d8' }}>· {show(s.cavityC, prefs.unit)}°{prefs.unit}</Text>
            ) : null}
          </View>
        </View>
      </View>

      <PictureMessage bottom={insets.bottom + 84}>{shot.message}</PictureMessage>

      {!demo ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <BarButton icon="download" label="Save" onPress={shot.save} busy={shot.busy === 'save'} disabled={!shot.ready} />
          {canShare ? <BarButton icon="share" label="Share" onPress={shot.share} busy={shot.busy === 'share'} disabled={!shot.ready} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function BarButton({ icon, label, onPress, busy, disabled }: { icon: IconName; label: string; onPress: () => void; busy: boolean; disabled: boolean }) {
  const { f } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Save' ? 'Save picture to Photos' : 'Share picture'}
      accessibilityState={{ disabled, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.barBtn, { opacity: disabled ? 0.45 : busy ? 0.7 : 1, backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)' }]}
    >
      <Icon name={icon} size={20} color="#fff" />
      <Text style={{ fontFamily: f.sansStrong, fontSize: 16, color: '#fff' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  waiting: { alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 12, paddingTop: 12, paddingHorizontal: 16 },
  barBtn: { minWidth: 120, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
});
