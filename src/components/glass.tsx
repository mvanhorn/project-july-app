// Drawing pieces for the Still Glass theme, ported from the Home Assistant July
// Oven card (july-oven-card.js): gradient fills, status marks, mode glyphs and
// the glowing mode tiles. Gradients are drawn with react-native-svg.
import { useId, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme';

const useSvgId = (p: string) => p + useId().replace(/[^a-zA-Z0-9]/g, '');

/** A linear gradient filling its parent (the parent clips it with overflow: hidden). */
export function Gradient({ colors, locations, horizontal, style }: { colors: string[]; locations?: number[]; horizontal?: boolean; style?: ViewStyle }) {
  const id = useSvgId('g');
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
          {colors.map((c, i) => <Stop key={i} offset={locations?.[i] ?? i / Math.max(1, colors.length - 1)} stopColor={c} />)}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** The card background: black glass with a faint diagonal sheen (white with no sheen in light). */
export function GlassFill() {
  const { c } = useTheme();
  const base = useSvgId('b');
  const sheen = useSvgId('s');
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={base} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.cardTop} />
          <Stop offset="1" stopColor={c.cardBottom} />
        </LinearGradient>
        {/* 112° in CSS: a narrow light band two thirds of the way across. */}
        <LinearGradient id={sheen} x1="0" y1="0.3" x2="1" y2="0.7">
          <Stop offset="0.63" stopColor={c.sheen} stopOpacity="0" />
          <Stop offset="0.634" stopColor={c.sheen} />
          <Stop offset="0.84" stopColor={c.sheen} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${base})`} />
      <Rect width="100%" height="100%" fill={`url(#${sheen})`} />
    </Svg>
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
// bake, broil, roast, toast, airfry and settings are the card's own; the rest are
// drawn to the same rules (48 box, 4 px stroke, 3 px for thin parts).

export function ModeGlyph({ mode, color, size, glow }: { mode: string; color: string; size: number; glow?: string }) {
  const body = glyphBody(mode, color, 4, 3);
  // The card glows its glyphs with drop-shadow filters; wide faint strokes under the
  // crisp ones give the same halo on every platform.
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: 'visible' }}>
      {glow ? <G opacity={0.12}>{glyphBody(mode, glow, 12, 11)}</G> : null}
      {glow ? <G opacity={0.2}>{glyphBody(mode, glow, 9, 8)}</G> : null}
      {glow ? <G opacity={0.3}>{glyphBody(mode, glow, 6.5, 5.5)}</G> : null}
      {body}
    </Svg>
  );
}

function glyphBody(mode: string, color: string, w: number, wThin: number) {
  const s = { stroke: color, strokeWidth: w, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const thin = { ...s, strokeWidth: wThin };
  return (() => {
    switch (mode) {
      case 'bake': return <Path d="M10 37h28" {...s} />;
      case 'broil': return <Path d="M10 11h28" {...s} />;
      case 'roast': return <Path d="M10 11h28M10 37h28" {...s} />;
      case 'toast': return <Path d="M10 11h7M20.5 11h7M31 11h7M10 37h7M20.5 37h7M31 37h7" {...s} />;
      case 'airfry': return (<>
        <Circle cx={24} cy={24} r={12.5} {...thin} />
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
export function ModeTile({ mode, label, size, onPress, util, selected, accessibilityLabel }: {
  mode: string; label: string; size: number; onPress: () => void; util?: boolean; selected?: boolean; accessibilityLabel?: string;
}) {
  const { c, f } = useTheme();
  const face = useSvgId('f');
  const glowId = useSvgId('w');
  const sheenId = useSvgId('h');
  const rx = size * 0.22;
  const [a, b, rim] = util ? [c.utilA, c.utilB, c.utilRim] : [c.tileA, c.tileB, selected ? c.ember : c.tileRim];
  const glyphColor = util ? c.utilGlyph : c.glyph;
  const glows = !util && c.glyphGlow !== 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => [{ alignItems: 'center', gap: 7, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={face} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={a} />
              <Stop offset="1" stopColor={b} />
            </LinearGradient>
            <RadialGradient id={glowId} cx="50%" cy="100%" rx="60%" ry="37.5%" fx="50%" fy="100%">
              <Stop offset="0" stopColor={util ? 'transparent' : c.tileGlow} />
              <Stop offset="1" stopColor={util ? 'transparent' : c.tileGlow} stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id={sheenId} x1="0" y1="0.2" x2="1" y2="0.8">
              <Stop offset="0.56" stopColor={c.tileSheen} stopOpacity="0" />
              <Stop offset="0.565" stopColor={c.tileSheen} stopOpacity="0.7" />
              <Stop offset="0.78" stopColor={c.tileSheen} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width={size} height={size} rx={rx} fill={`url(#${face})`} />
          <Rect width={size} height={size} rx={rx} fill={`url(#${glowId})`} />
          <Rect width={size} height={size} rx={rx} fill={`url(#${sheenId})`} />
          <Rect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={rx} fill="none" stroke={rim} strokeWidth={selected ? 2.5 : 1} />
        </Svg>
        <View style={{ position: 'absolute', left: size * 0.16, top: size * 0.16 }}>
          <ModeGlyph mode={mode} color={glyphColor} size={size * 0.68} glow={glows ? '#ff6a1a' : undefined} />
        </View>
      </View>
      <Text numberOfLines={1} style={{ fontFamily: f.sansMedium, fontSize: 16, lineHeight: 20, color: selected ? c.ember : c.ink, maxWidth: size + 16 }}>{label}</Text>
    </Pressable>
  );
}

/** The LIVE / age pill on a camera picture. */
export function CameraPill({ children }: { children: ReactNode }) {
  const { f } = useTheme();
  return (
    <View style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.66)' }}>
      <Text style={{ color: '#fff', fontFamily: f.sansStrong, fontSize: 11, letterSpacing: 0.66 }}>{children}</Text>
    </View>
  );
}
