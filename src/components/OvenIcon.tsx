// The oven's icon: the June countertop oven, as in the app icon (body, top bar, window
// with its handle at the right, two feet), in the Home Assistant card's line style
// (24 px grid, 1.75 stroke). Not a choice: every oven shows it.
//
// The icon is the oven's lamp: orange with a glow while it heats, the text colour
// while it is off, grey when offline (july-oven-card.js).
import { View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme';

export type Lamp = 'on' | 'off' | 'lost';

function draw(s: object) {
  return (<>
    <Rect x={3.5} y={5.5} width={17} height={11.5} rx={2.6} {...s} />
    <Path d="M6.5 8h11" {...s} />
    <Rect x={5.7} y={10} width={12.6} height={4.8} rx={1.1} {...s} />
    <Path d="M15.6 11.6v1.6M6.4 19.2h1.8M15.8 19.2h1.8" {...s} />
  </>);
}

/** The June oven in a colour; `glow` adds the heating halo. */
export function OvenIcon({ size, color, glow }: { size: number; color: string; glow?: string }) {
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
export function OvenLamp({ lamp, size }: { lamp: Lamp; size: number }) {
  const { c } = useTheme();
  const color = lamp === 'on' ? c.ember : lamp === 'lost' ? c.grey : c.ink;
  return (
    <View style={{ opacity: lamp === 'lost' ? 0.75 : 1 }}>
      <OvenIcon size={size} color={color} glow={lamp === 'on' && c.glow !== 'transparent' ? c.ember : undefined} />
    </View>
  );
}
