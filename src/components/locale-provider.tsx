'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { portalTranslations, type Locale } from '@/lib/i18n';
import { creatorTranslations } from '@/lib/creator-translations';
import { localeCookie } from '@/lib/locale.mjs';

const translations = { ...portalTranslations, ...creatorTranslations };
type LocaleContextValue = { locale: Locale; setLocale: (value: Locale) => void; t: (source: string) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const setLocale = useCallback((value: Locale) => {
    if (!['en', 'ru', 'zh'].includes(value)) return;
    document.cookie = localeCookie(value, window.location.hostname, window.location.protocol);
    updateLocale(value);
  }, []);
  useEffect(() => { document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale; }, [locale]);
  const t = useCallback((source: string) => locale === 'en' ? source : translations[source]?.[locale] ?? source, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}

export function LanguageSelector({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return <select data-language-selector className={className} aria-label={t('Language')} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
    <option value="en" lang="en">English</option>
    <option value="ru" lang="ru">Русский</option>
    <option value="zh" lang="zh">中文</option>
  </select>;
}
