// App themes. Each theme has a light and a dark palette, its own fonts, type
// scale, radii and a few component choices ("look").
//
// - glass (default): "Still Glass", the look of the Home Assistant July Oven card
//   (prj-july/ha-june-oven, docs/july-oven-card/DESIGN.md and
//   custom_components/june_oven/www/july-oven-card.js). Barlow type, the oven's
//   black glass in dark, a red Stop, glowing mode tiles and the heat-line bar.
//   Light-mode text colours are nudged darker than the card's where needed for
//   WCAG AA on the app's backgrounds.
// - july: the original July Oven design system (design-system/tokens.json).
import type { TextStyle } from 'react-native';

export type Mode = 'light' | 'dark';
export type ThemeId = 'glass' | 'july';

export type Colors = {
  surface: string; surfaceRaised: string; surfaceSunken: string; line: string; lineStrong: string;
  ink: string; inkMuted: string;
  ember: string; ember2: string; onEmber: string; emberSoft: string;
  ready: string; readySoft: string; heat: string; heatSoft: string; fault: string; faultSoft: string;
  cool: string; grey: string; glow: string; focus: string;
  stop: string; onStop: string;
  cardTop: string; cardBottom: string; sheen: string; win: string;
  tileA: string; tileB: string; tileRim: string; tileGlow: string; tileSheen: string; glyph: string; glyphGlow: string;
  utilA: string; utilB: string; utilRim: string; utilGlyph: string;
  go1: string; go2: string; onGo: string;
};

export type Fonts = {
  display: string; sans: string; sansMedium: string; sansStrong: string; mono: string;
  /** Large readouts (temperatures, timers, the clock). */
  number: string;
};

export type TypeName = 'hero' | 'title' | 'section' | 'lead' | 'body' | 'bodyStrong' | 'button' | 'small' | 'label' | 'code';
export type TypeScale = Record<TypeName, TextStyle>;

export type Radius = { sm: number; md: number; lg: number; full: number };

export type Look = {
  /** Status as a coloured pill (july) or a shape mark + uppercase word (glass). */
  status: 'pill' | 'mark';
  /** Cards drawn as glass: a vertical gradient with a faint diagonal sheen. */
  glassCards: boolean;
  /** Primary buttons: solid ember (july) or the card's orange gradient (glass). */
  primary: 'solid' | 'gradient';
  /** Stop: an outlined button behind a confirm (july) or one tap on solid red (glass). */
  stop: 'outline' | 'red';
  confirmStop: boolean;
  /** Progress: a solid bar (july) or the card's heat line (blue to ember while preheating). */
  bar: 'solid' | 'heatline';
  /** The oven tile on the home screen: the July OvenCard or the HA card layout. */
  hero: 'july' | 'glass';
  /** Minimum height of full-width buttons. */
  buttonHeight: number;
};

export type ThemeDef = {
  id: ThemeId;
  label: string;
  description: string;
  palette: Record<Mode, Colors>;
  fonts: Record<Mode, Fonts>;
  type: (f: Fonts) => TypeScale;
  radius: Radius;
  look: Look;
};

// --- July -------------------------------------------------------------------

const julyLight: Colors = {
  surface: '#faf6ef', surfaceRaised: '#ffffff', surfaceSunken: '#f1e9db', line: '#e6dcc9', lineStrong: '#8c7a60',
  ink: '#2a2019', inkMuted: '#675847',
  ember: '#b23c0d', ember2: '#b23c0d', onEmber: '#ffffff', emberSoft: '#fce5d2',
  ready: '#2f6a2c', readySoft: '#dcecd8', heat: '#8a5a00', heatSoft: '#fae7c8', fault: '#b3261e', faultSoft: '#f8dcd8',
  cool: '#8a5a00', grey: '#675847', glow: 'transparent', focus: '#b23c0d',
  stop: '#b3261e', onStop: '#ffffff',
  cardTop: '#ffffff', cardBottom: '#ffffff', sheen: 'transparent', win: '#f1e9db',
  tileA: '#ffffff', tileB: '#ffffff', tileRim: '#e6dcc9', tileGlow: 'transparent', tileSheen: 'transparent', glyph: '#b23c0d', glyphGlow: 'transparent',
  utilA: '#f1e9db', utilB: '#f1e9db', utilRim: '#e6dcc9', utilGlyph: '#675847',
  go1: '#b23c0d', go2: '#b23c0d', onGo: '#ffffff',
};

const julyDark: Colors = {
  surface: '#17130f', surfaceRaised: '#211b16', surfaceSunken: '#100c09', line: '#362f28', lineStrong: '#877869',
  ink: '#f4eee4', inkMuted: '#b8aa98',
  ember: '#f89a4e', ember2: '#f89a4e', onEmber: '#1b120a', emberSoft: '#3a1d0c',
  ready: '#74c46a', readySoft: '#18300f', heat: '#e2a83e', heatSoft: '#35280a', fault: '#f2867d', faultSoft: '#3a1411',
  cool: '#e2a83e', grey: '#b8aa98', glow: 'transparent', focus: '#f89a4e',
  stop: '#f2867d', onStop: '#1b120a',
  cardTop: '#211b16', cardBottom: '#211b16', sheen: 'transparent', win: '#100c09',
  tileA: '#211b16', tileB: '#211b16', tileRim: '#362f28', tileGlow: 'transparent', tileSheen: 'transparent', glyph: '#f89a4e', glyphGlow: 'transparent',
  utilA: '#100c09', utilB: '#100c09', utilRim: '#362f28', utilGlyph: '#b8aa98',
  go1: '#f89a4e', go2: '#f89a4e', onGo: '#1b120a',
};

const julyFonts: Fonts = {
  display: 'Fraunces_600SemiBold',
  sans: 'PublicSans_400Regular',
  sansMedium: 'PublicSans_600SemiBold',
  sansStrong: 'PublicSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  number: 'Fraunces_600SemiBold',
};

export const july: ThemeDef = {
  id: 'july',
  label: 'July',
  description: 'Warm kitchen tones, the Fraunces serif and soft cards.',
  palette: { light: julyLight, dark: julyDark },
  fonts: { light: julyFonts, dark: julyFonts },
  type: (f) => ({
    hero: { fontFamily: f.display, fontSize: 56, lineHeight: 60, letterSpacing: -0.56 },
    title: { fontFamily: f.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.34 },
    section: { fontFamily: f.display, fontSize: 26, lineHeight: 32 },
    lead: { fontFamily: f.sans, fontSize: 21, lineHeight: 32 },
    body: { fontFamily: f.sans, fontSize: 18, lineHeight: 28 },
    bodyStrong: { fontFamily: f.sansStrong, fontSize: 18, lineHeight: 28 },
    button: { fontFamily: f.sansStrong, fontSize: 18, lineHeight: 24 },
    small: { fontFamily: f.sans, fontSize: 15, lineHeight: 22 },
    label: { fontFamily: f.sansStrong, fontSize: 14, lineHeight: 18, letterSpacing: 0.56, textTransform: 'uppercase' },
    code: { fontFamily: f.mono, fontSize: 15, lineHeight: 24 },
  }),
  radius: { sm: 8, md: 12, lg: 20, full: 9999 },
  look: { status: 'pill', glassCards: false, primary: 'solid', stop: 'outline', confirmStop: true, bar: 'solid', hero: 'july', buttonHeight: 56 },
};

// --- Still Glass --------------------------------------------------------------

const glassDark: Colors = {
  surface: '#030304', surfaceRaised: '#0f1115', surfaceSunken: '#000000', line: '#25272b', lineStrong: '#5f6166',
  ink: '#f4f4f5', inkMuted: '#a1a1aa',
  ember: '#ff7a2e', ember2: '#ffb04a', onEmber: '#1a0a02', emberSoft: '#2e1511',
  ready: '#4ade80', readySoft: '#0e2a19', heat: '#fbbf24', heatSoft: '#2b2108', fault: '#f87171', faultSoft: '#2c1212',
  cool: '#5ab0e8', grey: '#8b9099', glow: 'rgba(255,106,26,0.55)', focus: '#7cc4f2',
  stop: '#c62828', onStop: '#ffffff',
  cardTop: '#08090b', cardBottom: '#0f1115', sheen: 'rgba(255,255,255,0.04)', win: '#000000',
  tileA: '#1d1210', tileB: '#2e1511', tileRim: 'rgba(255,122,64,0.36)', tileGlow: 'rgba(255,86,24,0.34)', tileSheen: 'rgba(255,255,255,0.07)',
  glyph: '#ffc247', glyphGlow: 'rgba(255,106,26,0.75)',
  utilA: '#191a1d', utilB: '#24262a', utilRim: 'rgba(255,255,255,0.16)', utilGlyph: '#c9ccd1',
  go1: '#f6a53a', go2: '#ea5a17', onGo: '#1a0a02',
};

const glassLight: Colors = {
  surface: '#f2f2f0', surfaceRaised: '#ffffff', surfaceSunken: '#ececee', line: '#e4e4e7', lineStrong: '#8a8d93',
  ink: '#18181b', inkMuted: '#5b5f66',
  ember: '#b93d0b', ember2: '#f08a3c', onEmber: '#ffffff', emberSoft: '#f5e9e2',
  ready: '#147436', readySoft: '#dcfce7', heat: '#a14b06', heatSoft: '#fef3c7', fault: '#b91c1c', faultSoft: '#fee2e2',
  cool: '#2f80c8', grey: '#71717a', glow: 'transparent', focus: '#1f6fb2',
  stop: '#c62828', onStop: '#ffffff',
  cardTop: '#ffffff', cardBottom: '#f7f7f5', sheen: 'transparent', win: '#111111',
  tileA: '#fbf7f4', tileB: '#f5e9e2', tileRim: 'rgba(217,72,15,0.26)', tileGlow: 'rgba(240,122,42,0.16)', tileSheen: 'rgba(255,255,255,0.7)',
  glyph: '#d9480f', glyphGlow: 'transparent',
  utilA: '#f6f6f7', utilB: '#ececee', utilRim: 'rgba(0,0,0,0.12)', utilGlyph: '#5e6567',
  go1: '#f6a53a', go2: '#ea5a17', onGo: '#1a0a02',
};

const glassFonts = (mode: Mode): Fonts => ({
  display: 'BarlowSemiCondensed_600SemiBold',
  sans: 'BarlowSemiCondensed_400Regular',
  sansMedium: 'BarlowSemiCondensed_500Medium',
  sansStrong: 'BarlowSemiCondensed_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  // The card draws numbers in light weight on glass and regular on white.
  number: mode === 'dark' ? 'BarlowCondensed_300Light' : 'BarlowCondensed_400Regular',
});

export const glass: ThemeDef = {
  id: 'glass',
  label: 'Still Glass',
  description: 'Matches the Home Assistant oven card: black glass, Barlow type, a red Stop.',
  palette: { light: glassLight, dark: glassDark },
  fonts: { light: glassFonts('light'), dark: glassFonts('dark') },
  // The card's sizes, scaled up a step for a phone held at arm's length.
  type: (f) => ({
    hero: { fontFamily: f.display, fontSize: 46, lineHeight: 50 },
    title: { fontFamily: f.display, fontSize: 32, lineHeight: 38 },
    section: { fontFamily: f.display, fontSize: 24, lineHeight: 30 },
    lead: { fontFamily: f.sans, fontSize: 20, lineHeight: 28 },
    body: { fontFamily: f.sans, fontSize: 18, lineHeight: 25 },
    bodyStrong: { fontFamily: f.sansMedium, fontSize: 18, lineHeight: 25 },
    button: { fontFamily: f.sansStrong, fontSize: 18, lineHeight: 22 },
    small: { fontFamily: f.sans, fontSize: 15, lineHeight: 21 },
    label: { fontFamily: f.sansStrong, fontSize: 14, lineHeight: 20, letterSpacing: 0.98, textTransform: 'uppercase' },
    code: { fontFamily: f.mono, fontSize: 15, lineHeight: 24 },
  }),
  radius: { sm: 10, md: 12, lg: 14, full: 9999 },
  look: { status: 'mark', glassCards: true, primary: 'gradient', stop: 'red', confirmStop: false, bar: 'heatline', hero: 'glass', buttonHeight: 52 },
};

export const THEMES: Record<ThemeId, ThemeDef> = { glass, july };
export const DEFAULT_THEME: ThemeId = 'glass';

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 12: 48 } as const;

export function shadow(mode: Mode, level: 'sm' | 'lg') {
  const dark = mode === 'dark';
  return level === 'sm'
    ? { shadowColor: dark ? '#000' : '#2a2019', shadowOpacity: dark ? 0.5 : 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
    : { shadowColor: dark ? '#000' : '#2a2019', shadowOpacity: dark ? 0.8 : 0.16, shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, elevation: 8 };
}
