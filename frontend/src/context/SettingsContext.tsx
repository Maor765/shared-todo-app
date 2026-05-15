import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, Lang } from '../i18n/translations';

type Theme = 'light' | 'dark';

interface SettingsContextValue {
  theme: Theme;
  lang: Lang;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('todo_theme') as Theme) || 'light',
  );
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('todo_lang') as Lang) || 'en',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
  }, [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
  }, []);

  const setTheme = (t: Theme) => {
    localStorage.setItem('todo_theme', t);
    setThemeState(t);
  };

  const setLang = (l: Lang) => {
    localStorage.setItem('todo_lang', l);
    setLangState(l);
  };

  const t = (key: string): string => {
    const val = translations[lang]?.[key];
    if (val) return val;
    return translations.en?.[key] ?? key;
  };

  return (
    <SettingsContext.Provider value={{ theme, lang, setTheme, setLang, t, isRTL: lang === 'he' }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
