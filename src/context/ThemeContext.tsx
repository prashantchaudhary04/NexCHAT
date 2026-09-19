import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppTheme, ChatBackground } from '../types';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isDark: boolean;
  toggleTheme: () => void;
  chatBackground: ChatBackground;
  setChatBackground: (bg: ChatBackground) => void;
  getChatBgClass: (bg?: string) => string;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const DARK_THEMES: AppTheme[] = ['dark', 'midnight', 'ocean', 'sunset', 'forest'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const stored = localStorage.getItem('app_theme') as AppTheme;
      if (stored) return stored;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [chatBackground, setChatBackgroundState] = useState<ChatBackground>(() => {
    try {
      const stored = localStorage.getItem('app_chat_bg') as ChatBackground;
      if (stored) return stored;
    } catch {
      // ignore
    }
    return 'default';
  });

  const isDark = DARK_THEMES.includes(theme);

  const applyThemeToDOM = (themeName: AppTheme) => {
    const root = document.documentElement;
    root.classList.remove(
      'theme-light',
      'theme-dark',
      'theme-midnight',
      'theme-ocean',
      'theme-sunset',
      'theme-forest',
      'theme-lavender'
    );
    root.classList.add(`theme-${themeName}`);

    if (DARK_THEMES.includes(themeName)) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  };

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('app_theme', newTheme);
    } catch {
      // ignore
    }
    applyThemeToDOM(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme: AppTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const setChatBackground = (bg: ChatBackground) => {
    setChatBackgroundState(bg);
    try {
      localStorage.setItem('app_chat_bg', bg);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const getChatBgClass = (bg?: string): string => {
    const activeBg = (bg || chatBackground) as ChatBackground;
    switch (activeBg) {
      case 'doodle':
        return 'bg-pattern-doodle';
      case 'dots':
        return 'bg-pattern-dots';
      case 'gradient':
        return 'bg-pattern-gradient';
      case 'dark_stars':
        return 'bg-pattern-stars';
      case 'minimal_grid':
        return 'bg-pattern-grid';
      case 'default':
      default:
        return 'bg-pattern-default';
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDark,
        toggleTheme,
        chatBackground,
        setChatBackground,
        getChatBgClass,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
