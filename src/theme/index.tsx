import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colorsFor, shadow, type Colors, type ThemeName } from './tokens';

export * from './tokens';

type Theme = { name: ThemeName; c: Colors; shadowSm: object; shadowLg: object };

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === 'dark' ? 'dark' : 'light';
  const value = useMemo<Theme>(
    () => ({ name, c: colorsFor(name), shadowSm: shadow(name, 'sm'), shadowLg: shadow(name, 'lg') }),
    [name],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
}
