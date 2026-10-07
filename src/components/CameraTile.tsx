// The oven camera as its own full-width tile while the oven is on: the live
// picture at 4:3, with Full screen, Save and Share in the top corner.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme';
import { canShare, usePictureActions } from './cameraShot';
import { CameraPill } from './glass';
import { Icon, type IconName } from './Icon';
import { useNow } from './OvenHero';
import { Card } from './ui';
import { useCameraFeed } from './useCameraFeed';

const DEMO_IMAGE = require('../../assets/demo-camera.jpg');

/** A round button over a picture: 40 px to see, 48 px to touch. */
export function PictureButton({ icon, label, onPress, busy, disabled }: { icon: IconName; label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.btn, { opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.55)' }]}
    >
      {busy ? <ActivityIndicator size="small" color="#fff" /> : <Icon name={icon} size={20} color="#fff" />}
    </Pressable>
  );
}

/** A short line over the picture after Save or Share. */
export function PictureMessage({ children, bottom = 12 }: { children: string | null; bottom?: number }) {
  const { f } = useTheme();
  if (!children) return null;
  return (
    <View pointerEvents="none" style={[styles.toastWrap, { bottom }]} accessibilityLiveRegion="polite">
      <View style={styles.toast}><Text style={{ fontFamily: f.sansMedium, fontSize: 15, color: '#fff' }}>{children}</Text></View>
    </View>
  );
}

export function CameraTile({ name, demo, on, onFullscreen }: { name: string; demo: boolean; on: boolean; onFullscreen: () => void }) {
  const { c, f, r } = useTheme();
  const src = useCameraFeed(on);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const now = useNow(true, 1000);
  const shot = usePictureActions(src, name);
  const source = demo ? DEMO_IMAGE : src ? { uri: src } : null;
  const at = demo ? now : shownAt;
  const age = at !== null ? now - at : null;
  const live = age !== null && age < 5000;

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${name} camera, ${live ? 'live' : 'waiting for a picture'}. Open full screen`}
        onPress={onFullscreen}
        style={[styles.frame, { backgroundColor: c.win, borderRadius: r.lg }]}
      >
        {source ? (
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
            cachePolicy="none"
            onLoad={() => setShownAt(Date.now())}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {at === null ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Icon name="camera" size={28} color={c.inkMuted} />
            <Text style={{ fontFamily: f.sansMedium, fontSize: 15, color: c.inkMuted }}>Waking the camera…</Text>
          </View>
        ) : (
          <CameraPill old={!live}>{live ? 'LIVE' : `${Math.round(age! / 1000)} s ago`}</CameraPill>
        )}
      </Pressable>
      <View style={styles.corner}>
        {!demo ? <PictureButton icon="download" label="Save picture to Photos" onPress={shot.save} busy={shot.busy === 'save'} disabled={!shot.ready} /> : null}
        {!demo && canShare ? <PictureButton icon="share" label="Share picture" onPress={shot.share} busy={shot.busy === 'share'} disabled={!shot.ready} /> : null}
        <PictureButton icon="expand" label="Full screen" onPress={onFullscreen} />
      </View>
      <PictureMessage>{shot.message}</PictureMessage>
    </Card>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.72)' },
});
