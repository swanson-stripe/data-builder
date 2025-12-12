'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';
export type ThemeMode = 'adaptive' | 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

type ThemeProviderProps = {
  children: ReactNode;
  /** Force a specific theme (used for pages that must remain light). */
  forceTheme?: Theme;
  /**
   * Whether to persist user choice in localStorage.
   * For light-only pages, we disable persistence to avoid overwriting editor preference.
   */
  persist?: boolean;
  /** localStorage key for persisted theme mode */
  storageKey?: string;
};

export function ThemeProvider({
  children,
  forceTheme,
  persist = true,
  storageKey = 'editorThemeMode',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mode, setModeState] = useState<ThemeMode>('adaptive');
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);

    // Forced theme (e.g. home/analytics/detail must be light)
    if (forceTheme) {
      setThemeState(forceTheme);
      setModeState(forceTheme);
      return;
    }

    if (persist) {
      // Prefer mode key
      const storedMode = localStorage.getItem(storageKey) as ThemeMode | null;
      if (storedMode === 'adaptive' || storedMode === 'light' || storedMode === 'dark') {
        setModeState(storedMode);
        // In fixed modes, theme is deterministic
        if (storedMode === 'light' || storedMode === 'dark') {
          setThemeState(storedMode);
        } else {
          // Adaptive defaults to light; page can temporarily override (e.g. SQL panel)
          setThemeState('light');
        }
        return;
      }
    }

    // Default: Adaptive, light UI by default
    setModeState('adaptive');
    setThemeState('light');
  }, []);

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (mounted && persist && !forceTheme) {
      // Persist fixed mode via storageKey. For adaptive, we only persist the mode,
      // not transient theme flips (e.g. SQL panel).
      localStorage.setItem(storageKey, mode);
      if (mode === 'light' || mode === 'dark') {
        localStorage.setItem('theme', mode);
      }
    }
  }, [theme, mounted, persist, forceTheme, mode, storageKey]);

  const setTheme = (newTheme: Theme) => {
    if (forceTheme) return;
    // In adaptive mode, pages may temporarily override theme (e.g. SQL editor).
    // In fixed modes, changing theme implies switching the mode.
    if (mode === 'adaptive') {
      setThemeState(newTheme);
      return;
    }
    setModeState(newTheme);
    setThemeState(newTheme);
  };

  const toggle = () => {
    if (forceTheme) return;
    if (mode === 'adaptive') {
      setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
      return;
    }
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      setModeState(next);
      return next;
    });
  };

  const setMode = (newMode: ThemeMode) => {
    if (forceTheme) return;
    setModeState(newMode);
    if (newMode === 'light' || newMode === 'dark') {
      setThemeState(newMode);
    } else {
      // Adaptive defaults to light; page can temporarily override
      setThemeState('light');
    }
  };

  const cycleMode = () => {
    if (forceTheme) return;
    setModeState((prev) => {
      const next: ThemeMode = prev === 'adaptive' ? 'light' : prev === 'light' ? 'dark' : 'adaptive';
      if (next === 'light' || next === 'dark') {
        setThemeState(next);
      } else {
        setThemeState('light');
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, mode, setMode, cycleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
