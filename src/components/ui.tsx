// React Native ports of the July Oven components (design-system/components).
import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

export type OvenState = 'ready' | 'paired' | 'preheating' | 'cooking' | 'offline' | 'fault' | 'idle';

// --- Text ------------------------------------------------------------------

type TextVariant = keyof typeof type;
export function T({ v = 'body', muted, color, style, children, ...rest }: {
  v?: TextVariant; muted?: boolean; color?: string; style?: TextStyle | TextStyle[];
  children: ReactNode; numberOfLines?: number; accessibilityRole?: 'header' | 'text';
}) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[type[v] as TextStyle, { color: color ?? (muted ? c.inkMuted : c.ink) }, style]}
    >
      {children}
    </Text>
  );
}

// --- Button ----------------------------------------------------------------

export function Button({ variant = 'secondary', icon, onPress, disabled, busy, children, style, accessibilityLabel }: {
  variant?: 'primary' | 'secondary' | 'quiet'; icon?: IconName; onPress?: () => void;
  disabled?: boolean; busy?: boolean; children: ReactNode; style?: ViewStyle; accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const fg = variant === 'primary' ? c.onEmber : variant === 'quiet' ? c.ember : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && { backgroundColor: c.ember, borderColor: c.ember },
        variant === 'secondary' && { backgroundColor: pressed ? c.surfaceSunken : c.surfaceRaised, borderColor: c.lineStrong },
        variant === 'quiet' && { backgroundColor: pressed ? c.emberSoft : 'transparent', borderColor: 'transparent', paddingHorizontal: space[3] },
        variant === 'primary' && pressed && { opacity: 0.9 },
        (disabled || busy) && { opacity: 0.5 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={[type.button, { color: fg }]}>{children}</Text>
    </Pressable>
  );
}

// --- StatusPill ------------------------------------------------------------

const PILL_LABEL: Record<OvenState, string> = {
  ready: 'Ready', paired: 'Paired', preheating: 'Preheating', cooking: 'Cooking',
  offline: 'Offline', fault: 'Needs attention', idle: 'Idle',
};

export function StatusPill({ state, children }: { state: OvenState; children?: ReactNode }) {
  const { c } = useTheme();
  const [bg, fg] =
    state === 'ready' || state === 'paired' ? [c.readySoft, c.ready]
    : state === 'preheating' ? [c.heatSoft, c.heat]
    : state === 'cooking' ? [c.emberSoft, c.ember]
    : state === 'fault' ? [c.faultSoft, c.fault]
    : [c.surfaceSunken, c.inkMuted];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessibilityRole="text" accessibilityLabel={`Status: ${children ?? PILL_LABEL[state]}`}>
      <View style={[styles.pillDot, { backgroundColor: fg }]} />
      <Text style={{ fontFamily: type.bodyStrong.fontFamily, fontSize: 15, color: fg }}>{children ?? PILL_LABEL[state]}</Text>
    </View>
  );
}

// --- Card / Notice / SetupStep --------------------------------------------

export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const { c, shadowSm } = useTheme();
  return (
    <View style={[styles.card, shadowSm, { backgroundColor: c.surfaceRaised, borderColor: c.line }, padded && { padding: space[5] }, style]}>
      {children}
    </View>
  );
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'success' | 'warning'; title?: ReactNode; children?: ReactNode }) {
  const { c } = useTheme();
  const bg = tone === 'success' ? c.readySoft : tone === 'warning' ? c.faultSoft : c.surfaceSunken;
  const mark = tone === 'success' ? c.ready : tone === 'warning' ? c.fault : c.inkMuted;
  return (
    <View
      style={[styles.notice, { backgroundColor: bg, borderColor: tone === 'info' ? c.line : 'transparent' }]}
      accessibilityLiveRegion={tone === 'warning' ? 'assertive' : 'none'}
    >
      <Icon name={tone === 'success' ? 'check-circle' : tone === 'warning' ? 'alert' : 'house'} color={mark} />
      <View style={{ flex: 1, gap: space[1] }}>
        {title ? <T v="bodyStrong">{title}</T> : null}
        {children ? <T muted>{children}</T> : null}
      </View>
    </View>
  );
}

export function SetupStep({ n, title, children, done }: { n: number; title: ReactNode; children?: ReactNode; done?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'flex-start' }}>
      <View style={[styles.stepNum, { backgroundColor: done ? c.readySoft : c.emberSoft }]}>
        {done ? <Icon name="check-circle" size={22} color={c.ready} /> : <Text style={[type.button, { color: c.ember }]}>{n}</Text>}
      </View>
      <View style={{ flex: 1, gap: space[1], paddingTop: 6 }}>
        <T v="bodyStrong">{title}</T>
        {children ? <T muted>{children}</T> : null}
      </View>
    </View>
  );
}

// --- Field -----------------------------------------------------------------

export const Field = forwardRef<TextInput, TextInputProps & { label: string; hint?: ReactNode; code?: boolean; error?: string }>(
  function Field({ label, hint, code, error, style, ...rest }, ref) {
    const { c } = useTheme();
    const [focused, setFocused] = useState(false);
    return (
      <View style={{ gap: space[2] }}>
        <Text style={{ fontFamily: type.bodyStrong.fontFamily, fontSize: 15, color: c.ink }}>{label}</Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={c.inkMuted}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          {...rest}
          style={[
            styles.input,
            { color: c.ink, backgroundColor: c.surfaceRaised, borderColor: error ? c.fault : focused ? c.ember : c.lineStrong },
            focused && { borderWidth: 2.5 },
            code && styles.inputCode,
            style,
          ]}
        />
        {error ? <T v="small" color={c.fault}>{error}</T> : hint ? <T v="small" muted>{hint}</T> : null}
      </View>
    );
  },
);

// --- Rows ------------------------------------------------------------------

export function Row({ icon, label, value, onPress, mono }: { icon?: IconName; label: string; value?: ReactNode; onPress?: () => void; mono?: boolean }) {
  const { c } = useTheme();
  const body = (
    <View style={styles.row}>
      {icon ? <Icon name={icon} color={c.inkMuted} /> : null}
      <T style={{ flex: 1 }}>{label}</T>
      {value != null ? <T v={mono ? 'code' : 'body'} muted numberOfLines={1}>{value}</T> : null}
      {onPress ? <Icon name="chevron-right" size={20} color={c.inkMuted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: c.surfaceSunken }}>
      {body}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: space[5] }} />;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 56, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space[6],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'flex-start',
    minHeight: 32, paddingLeft: space[3], paddingRight: space[4], borderRadius: radius.full,
  },
  pillDot: { width: 10, height: 10, borderRadius: radius.full },
  card: { borderRadius: radius.lg, borderWidth: 1 },
  notice: { flexDirection: 'row', gap: space[3], padding: space[5], borderRadius: radius.md, borderWidth: 1 },
  stepNum: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 56, paddingHorizontal: space[4], borderRadius: radius.sm, borderWidth: 1.5, fontFamily: type.body.fontFamily, fontSize: 18 },
  inputCode: { fontFamily: type.code.fontFamily, fontSize: 28, letterSpacing: 8, textAlign: 'center', minHeight: 64 },
  screenInner: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space[5], paddingTop: space[4], gap: space[6] },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space[4], paddingHorizontal: space[5] },
  footerInner: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space[3] },
  chip: { minHeight: 48, paddingHorizontal: space[4], borderRadius: radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md, borderWidth: 1, gap: 4 },
  segmentItem: { flex: 1, minHeight: 48, borderRadius: radius.sm, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5], minHeight: 56 },
});

// --- Layout & controls -----------------------------------------------------

export function Screen({ children, footer, scroll = true }: { children: ReactNode; footer?: ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const inner = <View style={styles.screenInner}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: footer ? space[6] : insets.bottom + space[8] }} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : inner}
      {footer ? (
        <View style={[styles.footer, { borderTopColor: c.line, backgroundColor: c.surface, paddingBottom: insets.bottom + space[4] }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <T v="label" muted accessibilityRole="header">{children}</T>;
}

export function Chip({ selected, onPress, children, accessibilityLabel }: { selected?: boolean; onPress: () => void; children: ReactNode; accessibilityLabel?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? c.ember : c.lineStrong, backgroundColor: selected ? c.emberSoft : pressed ? c.surfaceSunken : c.surfaceRaised },
        selected && { borderWidth: 2 },
      ]}
    >
      <Text style={[type.button, { fontSize: 16, color: selected ? c.ember : c.ink }]}>{children}</Text>
    </Pressable>
  );
}

export function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segment, { backgroundColor: c.surfaceSunken, borderColor: c.line }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(o.value); }}
            style={[styles.segmentItem, on && { backgroundColor: c.surfaceRaised, borderColor: c.lineStrong }]}
          >
            <Text style={[type.button, { fontSize: 16, color: on ? c.ink : c.inkMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RoundButton({ icon, onPress, label, disabled, size = 56 }: { icon: IconName; onPress: () => void; label: string; disabled?: boolean; size?: number }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
        { borderColor: c.lineStrong, backgroundColor: pressed ? c.surfaceSunken : c.surfaceRaised },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon name={icon} size={26} color={c.ink} />
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, pressed && { backgroundColor: c.surfaceSunken }]}
    >
      <Icon name={icon} color={c.ink} />
    </Pressable>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

/** Alert.alert does nothing on web; fall back to window.confirm there. */
export function confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? true);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Keep going', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

