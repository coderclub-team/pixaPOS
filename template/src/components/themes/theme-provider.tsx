'use client';

import * as React from 'react';

type ThemeName = 'light' | 'dark' | 'system';

export type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
  storageKey?: string;
  attribute?: 'class' | `data-${string}`;
  enableSystem?: boolean;
  enableColorScheme?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeContextValue = {
  theme: ThemeName;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const getSystemTheme = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const disableCssTransitions = () => {
  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode('*{transition:none!important;-webkit-transition:none!important;}')
  );
  document.head.appendChild(style);

  return () => {
    // Force style flush before cleanup so transition disabling applies this frame.
    void window.getComputedStyle(document.body);
    requestAnimationFrame(() => {
      style.remove();
    });
  };
};

export default function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  attribute = 'class',
  enableSystem = true,
  enableColorScheme = true,
  disableTransitionOnChange = false
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeName>(defaultTheme);

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem(storageKey) as ThemeName | null;
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      setThemeState(storedTheme);
    }
  }, [storageKey]);

  const resolvedTheme = React.useMemo<'light' | 'dark'>(() => {
    if (theme === 'system') {
      return enableSystem ? getSystemTheme() : 'light';
    }
    return theme;
  }, [enableSystem, theme]);

  React.useEffect(() => {
    if (theme !== 'system' || !enableSystem) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setThemeState('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [enableSystem, theme]);

  React.useEffect(() => {
    const root = document.documentElement;

    if (attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    } else {
      root.setAttribute(attribute, resolvedTheme);
    }

    if (enableColorScheme) {
      root.style.colorScheme = resolvedTheme;
    }
  }, [attribute, enableColorScheme, resolvedTheme]);

  const setTheme = React.useCallback(
    (nextTheme: ThemeName) => {
      const cleanup = disableTransitionOnChange ? disableCssTransitions() : null;
      setThemeState(nextTheme);
      window.localStorage.setItem(storageKey, nextTheme);
      cleanup?.();
    },
    [disableTransitionOnChange, storageKey]
  );

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }

  return context;
};
