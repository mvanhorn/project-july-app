// The camera window: floats over the glass card with the oven's camera at the chosen
// frame rate and × to close (july-oven-card.js, cameraSheet). Unlike the Home
// Assistant card, the phone can wake the camera, so it asks the oven to turn it on
// while the window is open.
import { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { useOven } from '@/state/oven';
import { useTheme } from '@/theme';
import { Gradient } from './glass';
import { useNow } from './OvenHero';

const DEMO_IMAGE = require('../../assets/demo-camera.jpg');

export function CameraWindow({ name, heating, onClose }: { name: string; heating: boolean; onClose: () => void }) {
  const { f } = useTheme();
  const { link, prefs } = useOven();
  const [src, setSrc] = useState<string | null>(null);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const now = useNow(true);

  // Keep the camera awake and pull pictures at the chosen rate while the window is open.
  useEffect(() => {
    if (!link) return;
    link.cameraOn(120);
    const wake = setInterval(() => link.cameraOn(120), 100_000);
    const ms = Math.max(200, 1000 / prefs.cameraFps);
    const pull = link.demo ? null : setInterval(() => setSrc(link.latestImageUrl()), ms);
    const first = link.demo ? null : setTimeout(() => setSrc(link.latestImageUrl()), 0);
    return () => { clearInterval(wake); if (pull) clearInterval(pull); if (first) clearTimeout(first); };
  }, [link, prefs.cameraFps]);

  // Back on Android, and Escape on the web, close the window.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (Platform.OS === 'web') window.addEventListener('keydown', key);
    return () => { sub.remove(); if (Platform.OS === 'web') window.removeEventListener('keydown', key); };
  }, [onClose]);

  const source = link?.demo ? DEMO_IMAGE : src ? { uri: src } : null;
  const at = link?.demo ? now : shownAt;
  const live = at !== null && now - at < 5000;
  const msg = at !== null ? null
    : failed ? (heating ? ['Waiting for a picture', 'The oven hasn’t sent a picture yet.'] : ['No picture yet', 'The camera is waking up. If it stays dark, check the camera service on the oven.'])
    : ['Waking the camera…', 'The first picture can take a few seconds.'];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={onClose} accessibilityLabel="Close the camera" />
      <View accessibilityViewIsModal accessibilityLabel={`${name} camera`} style={styles.win}>
        {source ? (
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={0}
            cachePolicy="none"
            onLoad={() => { setShownAt(Date.now()); setFailed(false); }}
            onError={() => setFailed(true)}
            accessibilityLabel="Live picture from inside the oven"
          />
        ) : null}
        {msg ? (
          <View style={styles.msg}>
            <CameraOff />
            <Text style={{ fontFamily: f.sansStrong, fontSize: 17, lineHeight: 22, color: '#f4f4f5', textAlign: 'center' }}>{msg[0]}</Text>
            <Text style={{ fontFamily: f.sans, fontSize: 14, lineHeight: 19, color: '#d4d4d8', textAlign: 'center' }}>{msg[1]}</Text>
          </View>
        ) : null}
        <View style={styles.bar}>
          <Gradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            {at !== null ? (
              <View style={[styles.pill, { backgroundColor: live ? '#c62828' : 'rgba(0,0,0,0.66)' }]}>
                <Text style={{ fontFamily: f.sansStrong, fontSize: 11, letterSpacing: 0.66, color: live ? '#fff' : '#fbbf24' }}>
                  {live ? 'LIVE' : `Picture from ${new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                </Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: f.sansStrong, fontSize: 16, color: '#fff' }}>{name}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close the camera" onPress={onClose} style={styles.close} hitSlop={4}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M6 6l12 12M18 6 6 18" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CameraOff() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Path d="M3 7.5h3l1.6-2h6.8l1.6 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" fill="none" stroke="#a1a1aa" strokeWidth={1.7} strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.2} fill="none" stroke="#a1a1aa" strokeWidth={1.7} />
      <Path d="M3.5 3.5l17 17" stroke="#a1a1aa" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  win: {
    position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 17, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  msg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24 },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, paddingRight: 6, paddingBottom: 18, paddingLeft: 14 },
  pill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
});
