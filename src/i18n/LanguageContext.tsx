'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import en, { type Translations } from './en';
import es from './es';

export type Locale = 'en' | 'es';

const dictionaries: Record<Locale, Translations> = { en, es };

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
};

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  t: en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ci_lang') as Locale | null;
    if (saved && (saved === 'en' || saved === 'es')) {
      setLocaleState(saved);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('ci_lang', newLocale);
  }, []);

  const t = dictionaries[locale];

  // Prevent flash of wrong language on first render
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
