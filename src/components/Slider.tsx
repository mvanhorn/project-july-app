// The review's temperature slider, drawn like the card's (july-oven-card.js, .d2-range):
// a 6 px track filled ember from the left, a white thumb with an ember ring. 48 px tall
// to touch; tap or drag anywhere on it. Screen readers adjust it a step at a time.
import { useRef, useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '@/theme';
import { Gradient } from './glass';

const THUMB = 26;

export function Slider({ value, min, max, step, onChange, accessibilityLabel, valueText }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  accessibilityLabel: string;
  valueText?: string;
}) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  // Where the touch started, on the track and on the screen.
  const start = useRef({ x: 0, page: 0 });

  const at = (x: number) => {
    const usable = Math.max(1, w - THUMB);
    const raw = min + ((x - THUMB / 2) / usable) * (max - min);
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  };
  const touch = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      start.current = { x: e.nativeEvent.locationX, page: e.nativeEvent.pageX };
      onChange(at(start.current.x));
    },
    onResponderMove: (e: GestureResponderEvent) => onChange(at(start.current.x + e.nativeEvent.pageX - start.current.page)),
  };

  const p = (value - min) / Math.max(1, max - min);
  const x = p * Math.max(0, w - THUMB);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.max(min, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{ height: 48, justifyContent: 'center' }}
      {...touch}
    >
      <View pointerEvents="none" style={{ height: 6, marginHorizontal: THUMB / 2, borderRadius: 3, overflow: 'hidden', backgroundColor: c.line }}>
        <View style={{ width: `${p * 100}%`, height: '100%', overflow: 'hidden' }}>
          <Gradient colors={[c.ember2, c.ember]} horizontal />
        </View>
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: x, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#fff',
          borderWidth: 3, borderColor: c.ember, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3,
        }}
      />
    </View>
  );
}
