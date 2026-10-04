// The oven's icon, from the Home Assistant card (july-oven-card.js, OVEN_ICONS): a set
// in the card's line style (24 px grid, 1.75 stroke), or any "mdi:" icon. The default
// here is the June countertop oven; the card's default (a range) is "range".
//
// The icon is the oven's lamp: orange with a glow while it heats, the text colour
// while it is off, grey when offline.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from 'react-native';
import Svg, { G, Path, Rect, Circle } from 'react-native-svg';
import { useTheme } from '@/theme';

type Draw = (s: object) => React.ReactNode;

export const OVEN_ICONS: Record<string, [label: string, draw: Draw]> = {
  // The June countertop oven, as in the app icon: body, top bar, window with its
  // handle at the right, two feet. (The card's own "oven" is a range; see below.)
  oven: ['June oven', (s) => (<>
    <Rect x={3.5} y={5.5} width={17} height={11.5} rx={2.6} {...s} />
    <Path d="M6.5 8h11" {...s} />
    <Rect x={5.7} y={10} width={12.6} height={4.8} rx={1.1} {...s} />
    <Path d="M15.6 11.6v1.6M6.4 19.2h1.8M15.8 19.2h1.8" {...s} />
  </>)],
  range: ['Range', (s) => (<>
    <Rect x={3.5} y={4} width={17} height={16} rx={2.5} {...s} />
    <Path d="M3.5 8.5h17M7 6.3h1.5M11 6.3h1.5" {...s} />
    <Rect x={7} y={11.5} width={10} height={5.5} rx={1.2} {...s} />
  </>)],
  kitchen: ['Kitchen', (s) => (<>
    <Path d="M5 10.5h14v5.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" {...s} />
    <Path d="M3.5 10.5h17M10 7.5h4M12 7.5V6" {...s} />
  </>)],
  house: ['House', (s) => (<>
    <Path d="M4 11.2 12 4.5l8 6.7" {...s} />
    <Path d="M6 9.6v9.9h12V9.6" {...s} />
    <Path d="M10 19.5v-5h4v5" {...s} />
  </>)],
  garage: ['Garage', (s) => (<>
    <Path d="M3.5 10 12 4.5l8.5 5.5v9.5h-17z" {...s} />
    <Path d="M7 19.5v-7h10v7M7 15h10M7 17.3h10" {...s} />
  </>)],
  basement: ['Basement', (s) => (<>
    <Path d="M3.5 7h4v4h4v4h4v4h5" {...s} />
    <Path d="M17 4.5v6M14.8 8.3 17 10.5l2.2-2.2" {...s} />
  </>)],
  apartment: ['Apartment', (s) => (<>
    <Rect x={6} y={3.5} width={12} height={17} rx={1.2} {...s} />
    <Path d="M9 7h2M13 7h2M9 10.5h2M13 10.5h2M9 14h2M13 14h2M11 20.5v-3h2v3" {...s} />
  </>)],
  cabin: ['Cabin', (s) => (<>
    <Path d="M3.5 19.5 12 4l8.5 15.5z" {...s} />
    <Path d="M8.2 13h7.6M10.5 19.5v-4h3v4" {...s} />
  </>)],
  patio: ['Patio', (s) => (<>
    <Path d="M4 10.5a8 8 0 0 1 16 0z" {...s} />
    <Path d="M12 10.5v9.5M8.5 20h7" {...s} />
  </>)],
  office: ['Office', (s) => (<>
    <Rect x={3.5} y={7.5} width={17} height={12} rx={2} {...s} />
    <Path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" {...s} />
  </>)],
  camper: ['Camper', (s) => (<>
    <Path d="M3.5 16.5v-8a2 2 0 0 1 2-2H15l5.5 5.5v4.5z" {...s} />
    <Rect x={6.5} y={9} width={4.5} height={3.2} rx={0.8} {...s} />
    <Circle cx={7.8} cy={17.3} r={1.8} {...s} />
    <Circle cx={16.3} cy={17.3} r={1.8} {...s} />
  </>)],
  bread: ['Bread', (s) => (<>
    <Path d="M5 11.2A3.8 3.8 0 0 1 7 4.5h10a3.8 3.8 0 0 1 2 6.7v7.3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" {...s} />
    <Path d="M10 8.5l-1.5 2.2M14.5 8.5 13 10.7" {...s} />
  </>)],
  star: ['Star', (s) => <Path d="M12 3.8l2.5 5.1 5.6.8-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" {...s} />],
};

/** The Material Design icon name in an "mdi:" value, if the font has it. */
export function mdiName(icon: string): keyof typeof MaterialCommunityIcons.glyphMap | null {
  if (!icon.startsWith('mdi:')) return null;
  const name = icon.slice(4);
  return name in MaterialCommunityIcons.glyphMap ? (name as keyof typeof MaterialCommunityIcons.glyphMap) : null;
}

export type Lamp = 'on' | 'off' | 'lost';

/** The oven's icon in a colour; `glow` adds the heating halo. */
export function OvenIcon({ icon, size, color, glow }: { icon: string; size: number; color: string; glow?: string }) {
  const mdi = mdiName(icon);
  if (mdi) {
    return (
      <View style={glow ? { shadowColor: glow, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } : undefined}>
        <MaterialCommunityIcons name={mdi} size={size} color={color} />
      </View>
    );
  }
  const draw = (OVEN_ICONS[icon] ?? OVEN_ICONS.oven)[1];
  const s = (c: string, w: number) => ({ stroke: c, strokeWidth: w, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });
  // Wide faint strokes under the crisp ones: the card's drop-shadow glow on every platform.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
      {glow ? <G opacity={0.14}>{draw(s(glow, 6))}</G> : null}
      {glow ? <G opacity={0.28}>{draw(s(glow, 3.5))}</G> : null}
      {draw(s(color, 1.75))}
    </Svg>
  );
}

/** The icon as the oven's lamp. */
export function OvenLamp({ icon, lamp, size }: { icon: string; lamp: Lamp; size: number }) {
  const { c } = useTheme();
  const color = lamp === 'on' ? c.ember : lamp === 'lost' ? c.grey : c.ink;
  return (
    <View style={{ opacity: lamp === 'lost' ? 0.75 : 1 }}>
      <OvenIcon icon={icon} size={size} color={color} glow={lamp === 'on' && c.glow !== 'transparent' ? c.ember : undefined} />
    </View>
  );
}
