// July Oven design tokens — mirrored from design-system/tokens.json.
// Edit the design system first, then copy values here.

export type ThemeName = 'light' | 'dark';

const palette = {
  surface: { light: '#faf6ef', dark: '#17130f' },
  surfaceRaised: { light: '#ffffff', dark: '#211b16' },
  surfaceSunken: { light: '#f1e9db', dark: '#100c09' },
  line: { light: '#e6dcc9', dark: '#362f28' },
  lineStrong: { light: '#8c7a60', dark: '#877869' },
  ink: { light: '#2a2019', dark: '#f4eee4' },
  inkMuted: { light: '#675847', dark: '#b8aa98' },
  ember: { light: '#b23c0d', dark: '#f89a4e' },
  onEmber: { light: '#ffffff', dark: '#1b120a' },
  emberSoft: { light: '#fce5d2', dark: '#3a1d0c' },
  ready: { light: '#2f6a2c', dark: '#74c46a' },
  readySoft: { light: '#dcecd8', dark: '#18300f' },
  heat: { light: '#8a5a00', dark: '#e2a83e' },
  heatSoft: { light: '#fae7c8', dark: '#35280a' },
  fault: { light: '#b3261e', dark: '#f2867d' },
  faultSoft: { light: '#f8dcd8', dark: '#3a1411' },
} as const;

export type Colors = { -readonly [K in keyof typeof palette]: string };

export function colorsFor(theme: ThemeName): Colors {
  const out = {} as Colors;
  for (const k of Object.keys(palette) as (keyof typeof palette)[]) out[k] = palette[k][theme];
  return out;
}

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 12: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 20, full: 9999 } as const;

// Font family names as registered by useFonts() in the root layout.
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  sans: 'PublicSans_400Regular',
  sansStrong: 'PublicSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, letterSpacing: -0.56 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.34 },
  section: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  lead: { fontFamily: fonts.sans, fontSize: 21, lineHeight: 32 },
  body: { fontFamily: fonts.sans, fontSize: 18, lineHeight: 28 },
  bodyStrong: { fontFamily: fonts.sansStrong, fontSize: 18, lineHeight: 28 },
  button: { fontFamily: fonts.sansStrong, fontSize: 18, lineHeight: 24 },
  small: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sansStrong, fontSize: 14, lineHeight: 18, letterSpacing: 0.56, textTransform: 'uppercase' as const },
  code: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 24 },
} as const;

export function shadow(theme: ThemeName, level: 'sm' | 'lg') {
  const dark = theme === 'dark';
  return level === 'sm'
    ? { shadowColor: dark ? '#000' : '#2a2019', shadowOpacity: dark ? 0.5 : 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
    : { shadowColor: dark ? '#000' : '#2a2019', shadowOpacity: dark ? 0.8 : 0.16, shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, elevation: 8 };
}
