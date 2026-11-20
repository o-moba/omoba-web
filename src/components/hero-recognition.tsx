'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/components/locale-provider';
import type { HeroRecognition } from '@/lib/types';

/** Expiry is displayed locally; only the server can grant Hero or month credit. */
export function HeroRecognitionBadge({ recognition }: { recognition: HeroRecognition }) {
  const { t, locale } = useLocale();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const active = recognition.hero_active && recognition.hero_until !== null &&
    (now === null || recognition.hero_until * 1000 > now);
  return <div className="hero-recognition">
    <span className={'hero-status' + (active ? ' is-active' : '')}>
      <span aria-hidden="true">✦</span> {active ? t('Hero active') : t('Supporter')}
    </span>
    <span className="supporter-months"><strong>{recognition.months_supported.toLocaleString(locale)}</strong> {t('Months supported')}</span>
    {active && recognition.hero_until !== null && <small>{t('Hero until')} {new Date(recognition.hero_until * 1000).toLocaleDateString(locale)}</small>}
  </div>;
}
