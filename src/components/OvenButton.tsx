// The oven's icon and name, top left on the glass card (july-oven-card.js, ovenButton).
// The icon is the oven's lamp. On the home screen the name tucks into the icon 5 s
// after the screen appears; it comes back while the oven menu is open, and during a
// cook it always shows. Tapping opens a menu of the ovens this phone knows.
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { OvenLamp, type Lamp } from './OvenIcon';

const TUCK_MS = 5000;

export type OvenButtonProps = {
  name: string;
  icon: string;
  lamp: Lamp;
  /** The lamp's word for screen readers and the menu: "off", "preheating", "offline"… */
  state: string;
  /** Tuck the name away 5 s after this becomes true (the home screen with the setting on). */
  tuck: boolean;
  size?: number;
};

export function OvenButton({ name, icon, lamp, state, tuck, size = 22 }: OvenButtonProps) {
  const { c, f } = useTheme();
  const [tucked, setTucked] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [nameW, setNameW] = useState(0);
  const [shown] = useState(() => new Animated.Value(1));
  const ref = useRef<View>(null);

  // Each return to the home screen shows the name again for 5 s.
  const [wasTuck, setWasTuck] = useState(tuck);
  if (tuck !== wasTuck) {
    setWasTuck(tuck);
    setTucked(false);
  }
  useEffect(() => {
    if (!tuck) return;
    const t = setTimeout(() => setTucked(true), TUCK_MS);
    return () => clearTimeout(t);
  }, [tuck]);

  const hidden = tuck && tucked && !menu;
  useEffect(() => {
    Animated.timing(shown, { toValue: hidden ? 0 : 1, duration: 450, useNativeDriver: false }).start();
  }, [hidden, shown]);

  function open() {
    ref.current?.measureInWindow((x, y, _w, h) => setMenu({ x: Math.max(8, x - 4), y: y + h + 6 }));
  }

  return (
    <>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${state}. Choose an oven`}
        accessibilityState={{ expanded: !!menu }}
        onPress={open}
        hitSlop={4}
        style={({ pressed }) => [styles.button, { backgroundColor: pressed || menu ? c.surfaceSunken : 'transparent' }]}
      >
        <OvenLamp icon={icon} lamp={lamp} size={Math.round(size * 1.2)} />
        <Animated.View
          style={{
            flexShrink: 1, minWidth: 0, overflow: 'hidden', opacity: shown,
            width: nameW ? shown.interpolate({ inputRange: [0, 1], outputRange: [0, nameW] }) : undefined,
          }}
        >
          <Text numberOfLines={1} style={{ paddingLeft: size * 0.4, fontFamily: f.sansMedium, fontSize: size, lineHeight: size * 1.27, color: c.ink }}>{name}</Text>
        </Animated.View>
        {/* Measures the name's natural width (in room enough for any name), for the tuck animation. */}
        {/* The zero-size clip keeps the wide room from making the card scrollable. */}
        <View aria-hidden pointerEvents="none" style={styles.clip}>
          <View style={styles.measure}>
            <Text
              numberOfLines={1}
              onLayout={(e) => setNameW(Math.ceil(e.nativeEvent.layout.width))}
              style={{ alignSelf: 'flex-start', paddingLeft: size * 0.4, fontFamily: f.sansMedium, fontSize: size, lineHeight: size * 1.27 }}
            >
              {name}
            </Text>
          </View>
        </View>
      </Pressable>

      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)} statusBarTranslucent navigationBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close the oven menu" onPress={() => setMenu(null)} />
        {menu ? (
          <View accessibilityRole="menu" style={[styles.menu, { left: menu.x, top: menu.y, backgroundColor: c.surfaceRaised, borderColor: c.line }]}>
            <Pressable
              accessibilityRole="menuitem"
              accessibilityState={{ checked: true }}
              onPress={() => setMenu(null)}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.surfaceSunken }]}
            >
              <OvenLamp icon={icon} lamp={lamp} size={22} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: f.sansMedium, fontSize: 17, color: c.ink }}>{name}</Text>
              <Text style={{ fontFamily: f.sansStrong, fontSize: 12, letterSpacing: 0.84, textTransform: 'uppercase', color: lamp === 'on' ? c.ember : c.inkMuted }}>{state}</Text>
              <Icon name="check-circle" size={18} color={c.inkMuted} />
            </Pressable>
            <Text style={{ fontFamily: f.sans, fontSize: 13, lineHeight: 18, color: c.inkMuted, paddingHorizontal: 10, paddingBottom: 6 }}>
              This phone is paired with one oven.
            </Text>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, marginVertical: -8, marginLeft: -6, paddingHorizontal: 6, borderRadius: 12 },
  clip: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'hidden' },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0, width: 2000 },
  menu: { position: 'absolute', width: 260, padding: 6, borderRadius: 14, borderWidth: 1, gap: 2, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 10, borderRadius: 10 },
});
