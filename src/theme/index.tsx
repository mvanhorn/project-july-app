import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { load, save } from '@/state/storage';
import {
  DEFAULT_THEME, THEMES, shadow,
  type Colors, type Fonts, type Look, type Mode, type Radius, type ThemeId, type TypeScale,
} from './themes';

export * from './themes';

export type Appearance = 'system' | 'light' | 'dark';

type Theme = {
  id: ThemeId;
  /** The palette in use right now (light or dark). */
  name: Mode;
  c: Colors;
  f: Fonts;
  t: TypeScale;
  r: Radius;
  look: Look;
  shadowSm: object;
  shadowLg: object;
};

type ThemeSettings = {
  themeId: ThemeId;
  appearance: Appearance;
  setThemeId(id: ThemeId): void;
  setAppearance(a: Appearance): void;
};

const THEME_KEY = 'july.theme.v1';
const ThemeContext = createContext<Theme | null>(null);
const SettingsContext = createContext<ThemeSettings | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [loaded, setLoaded] = useState(false);
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [appearance, setAppearanceState] = useState<Appearance>('system');

  useEffect(() => {
    load<{ themeId?: ThemeId; appearance?: Appearance }>(THEME_KEY).then((saved) => {
      if (saved?.themeId && saved.themeId in THEMES) setThemeIdState(saved.themeId);
      if (saved?.appearance) setAppearanceState(saved.appearance);
      setLoaded(true);
    });
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    save(THEME_KEY, { themeId: id, appearance });
  }, [appearance]);

  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a);
    save(THEME_KEY, { themeId, appearance: a });
  }, [themeId]);

  const name: Mode = appearance === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : appearance;
  const theme = useMemo<Theme>(() => {
    const def = THEMES[themeId];
    const f = def.fonts[name];
    return {
      id: themeId, name, c: def.palette[name], f, t: def.type(f), r: def.radius, look: def.look,
      shadowSm: shadow(name, 'sm'), shadowLg: shadow(name, 'lg'),
    };
  }, [themeId, name]);
  const settings = useMemo(() => ({ themeId, appearance, setThemeId, setAppearance }), [themeId, appearance, setThemeId, setAppearance]);

  // Wait for the saved choice so the app never flashes the wrong theme.
  if (!loaded) return null;
  return (
    <SettingsContext.Provider value={settings}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </SettingsContext.Provider>
  );
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
}

export function useThemeSettings(): ThemeSettings {
  const s = useContext(SettingsContext);
  if (!s) throw new Error('useThemeSettings outside ThemeProvider');
  return s;
}
