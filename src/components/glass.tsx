// Drawing pieces for the Still Glass theme, ported from the Home Assistant July
// Oven card (july-oven-card.js): gradient fills, status marks, mode glyphs and
// the glowing mode tiles. Gradients are drawn with react-native-svg.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme';

const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9]/g, '');

/**
 * A gradient stop's colour and opacity. On iOS and Android react-native-svg
 * replaces a stop colour's own alpha with stopOpacity, so the card's 4% white
 * sheen drew as solid white. Split rgba() into a colour and an opacity.
 */
export function stopOf(color: string, opacity = 1): { stopColor: string; stopOpacity: number } {
  if (color === 'transparent') return { stopColor: '#000000', stopOpacity: 0 };
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color);
  if (!m) return { stopColor: color, stopOpacity: opacity };
  return { stopColor: `rgb(${m[1]},${m[2]},${m[3]})`, stopOpacity: opacity * (m[4] === undefined ? 1 : Number(m[4])) };
}

/**
 * Fills its parent with an SVG drawn at the measured size. A "100%" SVG can keep
 * the size it first saw on Android (a button's gradient stopped short of its right
 * edge), so the SVG gets exact pixels from a layer that does follow the parent.
 */
function Fill({ style, children }: { style?: ViewStyle; children: (w: number, h: number) => ReactNode }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
      }}
    >
      {size && size.w > 0 && size.h > 0 ? children(size.w, size.h) : null}
    </View>
  );
}

/** A linear gradient filling its parent (the parent clips it with overflow: hidden). */
export function Gradient({ colors, locations, horizontal, style }: { colors: string[]; locations?: number[]; horizontal?: boolean; style?: ViewStyle }) {
  const id = useSvgId('g');
  return (
    <Fill style={style}>
      {(w, h) => (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
              {colors.map((c, i) => <Stop key={i} offset={locations?.[i] ?? i / Math.max(1, colors.length - 1)} {...stopOf(c)} />)}
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} fill={`url(#${id})`} />
        </Svg>
      )}
    </Fill>
  );
}

/** The card background: black glass with a faint diagonal sheen (white with no sheen in light). */
export function GlassFill() {
  const { c } = useTheme();
  const base = useSvgId('b');
  const sheen = useSvgId('s');
  return (
    <Fill>
      {(w, h) => (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id={base} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" {...stopOf(c.cardTop)} />
              <Stop offset="1" {...stopOf(c.cardBottom)} />
            </LinearGradient>
            {/* 112° in CSS: a narrow light band two thirds of the way across. */}
            <LinearGradient id={sheen} x1="0" y1="0.3" x2="1" y2="0.7">
              <Stop offset="0.63" {...stopOf(c.sheen, 0)} />
              <Stop offset="0.634" {...stopOf(c.sheen)} />
              <Stop offset="0.84" {...stopOf(c.sheen, 0)} />
            </LinearGradient>
          </Defs>
          <Rect width={w} height={h} fill={`url(#${base})`} />
          <Rect width={w} height={h} fill={`url(#${sheen})`} />
        </Svg>
      )}
    </Fill>
  );
}

// --- Status marks: shape + colour + word, never colour alone --------------------

export type MarkKind = 'off' | 'preheat' | 'cooking' | 'ready' | 'done' | 'offline' | 'warn';

export const MARK_TONE: Record<MarkKind, 'heat' | 'ok' | 'warn' | 'rest'> = {
  off: 'rest', preheat: 'heat', cooking: 'heat', ready: 'ok', done: 'ok', offline: 'rest', warn: 'warn',
};

export function StatusMark({ kind, size = 16 }: { kind: MarkKind; size?: number }) {
  const { c } = useTheme();
  const tone = MARK_TONE[kind];
  const color = tone === 'heat' ? c.ember : tone === 'ok' ? c.ready : tone === 'warn' ? c.heat : c.grey;
  const s = { stroke: color, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <View style={tone === 'heat' && c.glow !== 'transparent' && Platform.OS !== 'web' ? { shadowColor: c.ember, shadowOpacity: 0.55, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } } : undefined}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        {kind === 'off' ? <Circle cx={10} cy={10} r={7} strokeWidth={2} {...s} /> : null}
        {kind === 'preheat' ? <Path d="M10 17V3.8M4.6 9.2 10 3.8l5.4 5.4" strokeWidth={2.4} {...s} /> : null}
        {kind === 'cooking' ? (
          <G transform="scale(1.25)">
            <Path d="M8.3 1.2c.4 2.6 4.4 4.2 4.4 8.4A4.7 4.7 0 0 1 3.3 9.8c0-2.1 1-3.4 2.1-4.3.1 1.6.9 2.5 1.7 2.7-.5-2.2-.1-4.6 1.2-7z" fill={color} />
          </G>
        ) : null}
        {kind === 'ready' ? (<>
          <Circle cx={10} cy={10} r={7.2} strokeWidth={2} {...s} />
          <Path d="M6.6 10.3l2.3 2.3 4.6-5" strokeWidth={2} {...s} />
        </>) : null}
        {kind === 'done' ? (<>
          <Circle cx={10} cy={10} r={8.5} fill={color} />
          <Path d="M6.3 10.3l2.6 2.6 4.9-5.4" strokeWidth={2.2} {...s} stroke={c.cardTop} />
        </>) : null}
        {kind === 'offline' ? (<>
          <Circle cx={10} cy={10} r={7} strokeWidth={2} strokeDasharray="3.2 2.4" {...s} />
          <Path d="M4.2 15.8 15.8 4.2" strokeWidth={2} {...s} />
        </>) : null}
        {kind === 'warn' ? (<>
          <Path d="M10 3 18 16.5H2Z" strokeWidth={2} {...s} />
          <Path d="M10 8.2v3.6" strokeWidth={2} {...s} />
          <Circle cx={10} cy={14.2} r={1} fill={color} />
        </>) : null}
      </Svg>
    </View>
  );
}

/** The card's status line: mark, then the word in small capitals. */
export function StatusLine({ kind, word, qualifier, size = 'normal' }: { kind: MarkKind; word: string; qualifier?: string; size?: 'normal' | 'small' }) {
  const { c, f } = useTheme();
  const fs = size === 'small' ? 13 : 15;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} accessible accessibilityLabel={`Status: ${word}${qualifier ? `, ${qualifier}` : ''}`}>
      <StatusMark kind={kind} size={size === 'small' ? 14 : 17} />
      <Text style={{ fontFamily: f.sansStrong, fontSize: fs, lineHeight: 22, letterSpacing: fs * 0.07, textTransform: 'uppercase', color: c.ink }}>{word}</Text>
      {qualifier ? <Text style={{ fontFamily: f.sans, fontSize: fs + 1, lineHeight: 22, color: c.inkMuted }}>· {qualifier}</Text> : null}
    </View>
  );
}

// --- Mode glyphs: the heating elements each mode uses -----------------------------
// bake, broil, roast, toast, airfry, camera and settings are the card's own; the rest are
// drawn to the same rules (48 box, 4 px stroke, 3 px for thin parts).

export function ModeGlyph({ mode, color, size, glow, fan }: {
  mode: string; color: string; size: number; glow?: string;
  /** Air fry only: the fan's turn, drawn on its own layer so it can spin. */
  fan?: Animated.Value;
}) {
  // The card glows its glyphs with drop-shadow filters; wide faint strokes under the
  // crisp ones give the same halo on every platform.
  const layers = (m: string) => (<>
    {glow ? <G opacity={0.12}>{glyphBody(m, glow, 12, 11)}</G> : null}
    {glow ? <G opacity={0.2}>{glyphBody(m, glow, 9, 8)}</G> : null}
    {glow ? <G opacity={0.3}>{glyphBody(m, glow, 6.5, 5.5)}</G> : null}
    {glyphBody(m, color, 4, 3)}
  </>);
  if (mode === 'airfry' && fan) {
    const rotate = fan.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: 'visible' }}>{layers('airfry-ring')}</Svg>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
          <Svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: 'visible' }}>{layers('airfry-fan')}</Svg>
        </Animated.View>
      </View>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: 'visible' }}>{layers(mode)}</Svg>
  );
}

/**
 * The Air fry fan, as on the card (v0.4.9): it spins up while the tile is pressed
 * (or hovered on the web) and, on letting go, eases to a stop on the next third of
 * a turn, so it rests exactly as drawn (the three blades are identical). Still
 * when the phone asks for reduced motion.
 */
class FanSpin {
  readonly angle = new Animated.Value(0);
  reduceMotion = false;
  private a = 0; // degrees
  private v = 0; // degrees per second
  private on = false;
  private t = 0;
  private raf = 0;
  private stop: { a0: number; D: number; T: number; s: number } | null = null;

  spin(on: boolean) {
    if (on && this.reduceMotion) return;
    if (!on && !this.raf) return;
    this.on = on;
    this.stop = null;
    if (!this.raf) { this.t = performance.now(); this.raf = requestAnimationFrame(this.step); }
  }

  cancel() { cancelAnimationFrame(this.raf); this.raf = 0; }

  private step = (t: number) => {
    const SPEED = 720, SPIN_UP = 0.35, COAST = 0.35; // deg/s at full speed; seconds to reach it; least coast
    const dt = Math.min(0.05, Math.max(0, (t - this.t) / 1000));
    this.t = t;
    if (this.on) {
      this.v = Math.min(SPEED, this.v + (SPEED / SPIN_UP) * dt);
      this.a = (this.a + this.v * dt) % 360;
    } else {
      if (!this.stop) {
        // Ease out from the current speed (cubic: starting speed 3D/T) onto the next third of a turn.
        const target = Math.ceil((this.a + this.v * COAST) / 120 - 1e-6) * 120, D = target - this.a;
        this.stop = { a0: this.a, D, T: D < 0.01 ? 0 : Math.min(2, Math.max(0.3, (3 * D) / Math.max(this.v, 1))), s: 0 };
      }
      const st = this.stop;
      st.s += dt;
      const k = st.T ? Math.min(1, st.s / st.T) : 1, r = 1 - k;
      this.a = st.a0 + st.D * (1 - r * r * r);
      this.v = st.T ? ((3 * st.D) / st.T) * r * r : 0;
      if (k >= 1) {
        this.a = this.v = this.raf = 0;
        this.stop = null;
        this.angle.setValue(0);
        return;
      }
    }
    this.angle.setValue(this.a);
    this.raf = requestAnimationFrame(this.step);
  };
}

function useFanSpin(enabled: boolean): FanSpin | null {
  const [fan] = useState(() => new FanSpin());
  useEffect(() => {
    if (!enabled) return;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => { fan.reduceMotion = r; }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (r) => { fan.reduceMotion = r; });
    return () => { sub.remove(); fan.cancel(); };
  }, [enabled, fan]);
  return enabled ? fan : null;
}

function glyphBody(mode: string, color: string, w: number, wThin: number): ReactNode {
  const s = { stroke: color, strokeWidth: w, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const thin = { ...s, strokeWidth: wThin };
  return ((): ReactNode => {
    switch (mode) {
      case 'bake': return <Path d="M10 37h28" {...s} />;
      case 'broil': return <Path d="M10 11h28" {...s} />;
      case 'roast': return <Path d="M10 11h28M10 37h28" {...s} />;
      case 'toast': return <Path d="M10 11h7M20.5 11h7M31 11h7M10 37h7M20.5 37h7M31 37h7" {...s} />;
      case 'airfry': return (<>{glyphBody('airfry-ring', color, w, wThin)}{glyphBody('airfry-fan', color, w, wThin)}</>);
      // Air fry in two layers, so the fan can turn inside its ring.
      case 'airfry-ring': return <Circle cx={24} cy={24} r={12.5} {...thin} />;
      case 'airfry-fan': return (<>
        {[0, 120, 240].map((a) => <Path key={a} transform={`rotate(${a} 24 24)`} d="M24 24c-1.5-5.5 1-9.5 5-9.2 2.6.3 2.8 4.4-5 9.2z" fill={color} />)}
      </>);
      case 'pizzaiolo': return (<>
        <Path d="M10 11h28M10 37h28" {...s} />
        <Path d="M16 30.5 24 17l8 13.5Z" {...thin} />
      </>);
      case 'reheat': return (<>
        <Path d="M10 37h28" {...s} />
        <Path d="M31 23.5a7.5 7.5 0 1 1-2.6-5.7" {...thin} />
        <Path d="M29.5 13.5v5h-5" {...thin} />
      </>);
      case 'warm': return (<>
        <Path d="M10 37h28" {...s} />
        <Path d="M17 29c-2.5-3 2.5-5 0-8.5M24 29c-2.5-3 2.5-5 0-8.5M31 29c-2.5-3 2.5-5 0-8.5" {...thin} />
      </>);
      case 'dehydrate': return <Path d="M24 11c5.5 7 9 11.5 9 16a9 9 0 0 1-18 0c0-4.5 3.5-9 9-16Z" {...thin} />;
      case 'proof': return (<>
        <Path d="M10 37h28" {...s} />
        <Path d="M13 31c0-7 5-11 11-11s11 4 11 11" {...thin} />
        <Path d="M24 15v-4M19.5 12.5 24 11l4.5 1.5" {...thin} />
      </>);
      case 'slow_cook': return (<>
        <Path d="M10 37h28" {...s} />
        <Circle cx={24} cy={21} r={9} {...thin} />
        <Path d="M24 16v5l3.5 2" {...thin} />
      </>);
      case 'camera': return (<>
        <Path d="M9 16.5h6.5l3-4h11l3 4H39a2.5 2.5 0 0 1 2.5 2.5v15a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 34V19A2.5 2.5 0 0 1 9 16.5z" {...thin} />
        <Circle cx={24} cy={26.5} r={6.5} {...thin} />
      </>);
      case 'settings':
      case 'more': return (<>
        <Circle cx={24} cy={24} r={9} {...thin} />
        <Circle cx={24} cy={24} r={3.5} {...thin} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <Path key={a} transform={`rotate(${a} 24 24)`} d="M24 11.5v3.5" {...s} />)}
      </>);
      default: return <Path d="M10 37h28" {...s} />;
    }
  })();
}

/** A square glowing tile with the mode's glyph, its label underneath. */
export function ModeTile({ mode, label, size, onPress, util, selected, accessibilityLabel, labelWidth, untested }: {
  mode: string; label: string; size: number; onPress?: () => void; util?: boolean; selected?: boolean; accessibilityLabel?: string;
  /** Room for the label; defaults to a little wider than the tile. */
  labelWidth?: number;
  /** A mode not yet started on a real oven (CookMode.untested): a small "?" in the corner. */
  untested?: boolean;
}) {
  const { c, f } = useTheme();
  const face = useSvgId('f');
  const glowId = useSvgId('w');
  const sheenId = useSvgId('h');
  const rx = size * 0.22;
  const [a, b, rim] = util ? [c.utilA, c.utilB, c.utilRim] : [c.tileA, c.tileB, selected ? c.ember : c.tileRim];
  const glyphColor = util ? c.utilGlyph : c.glyph;
  const glows = !util && c.glyphGlow !== 'transparent';
  const fan = useFanSpin(mode === 'airfry' && !!onPress);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={!onPress}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      onPressIn={() => fan?.spin(true)}
      onPressOut={() => fan?.spin(false)}
      onHoverIn={() => fan?.spin(true)}
      onHoverOut={() => fan?.spin(false)}
      style={({ pressed }) => [{ alignItems: 'center', gap: 7, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={face} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" {...stopOf(a)} />
              <Stop offset="1" {...stopOf(b)} />
            </LinearGradient>
            <RadialGradient id={glowId} cx="50%" cy="100%" rx="60%" ry="37.5%" fx="50%" fy="100%">
              <Stop offset="0" {...stopOf(util ? 'transparent' : c.tileGlow)} />
              <Stop offset="1" {...stopOf(util ? 'transparent' : c.tileGlow, 0)} />
            </RadialGradient>
            <LinearGradient id={sheenId} x1="0" y1="0.2" x2="1" y2="0.8">
              <Stop offset="0.56" {...stopOf(c.tileSheen, 0)} />
              <Stop offset="0.565" {...stopOf(c.tileSheen, 0.7)} />
              <Stop offset="0.78" {...stopOf(c.tileSheen, 0)} />
            </LinearGradient>
          </Defs>
          <Rect width={size} height={size} rx={rx} fill={`url(#${face})`} />
          <Rect width={size} height={size} rx={rx} fill={`url(#${glowId})`} />
          <Rect width={size} height={size} rx={rx} fill={`url(#${sheenId})`} />
          <Rect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={rx} fill="none" stroke={rim} strokeWidth={selected ? 2.5 : 1} />
        </Svg>
        <View style={{ position: 'absolute', left: size * 0.16, top: size * 0.16 }}>
          <ModeGlyph mode={mode} color={glyphColor} size={size * 0.68} glow={glows ? '#ff6a1a' : undefined} fan={fan?.angle} />
        </View>
        {untested ? (
          <View style={{
            position: 'absolute', top: size * 0.07, right: size * 0.07, width: Math.max(16, size * 0.22), height: Math.max(16, size * 0.22),
            borderRadius: 999, borderWidth: 1, borderColor: c.utilRim, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: f.sansStrong, fontSize: Math.max(10, size * 0.14), lineHeight: Math.max(13, size * 0.18), color: c.inkMuted }}>?</Text>
          </View>
        ) : null}
      </View>
      {label ? <Text numberOfLines={1} style={{ fontFamily: f.sansMedium, fontSize: 16, lineHeight: 20, color: selected ? c.ember : c.ink, maxWidth: labelWidth ?? size + 16 }}>{label}</Text> : null}
    </Pressable>
  );
}

/** The LIVE / age pill on a camera picture; an old picture's age is amber. */
export function CameraPill({ children, old }: { children: ReactNode; old?: boolean }) {
  const { f } = useTheme();
  return (
    <View style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.66)' }}>
      <Text style={{ color: old ? '#fbbf24' : '#fff', fontFamily: f.sansStrong, fontSize: 11, letterSpacing: 0.66 }}>{children}</Text>
    </View>
  );
}
