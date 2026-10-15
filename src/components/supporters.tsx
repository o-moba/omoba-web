'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiFailure } from '@/lib/client-api';
import { useLocale } from '@/components/locale-provider';
import { HeroRecognitionBadge } from '@/components/hero-recognition';
import type { SupportersDirectory } from '@/lib/types';

export default function SupportersView({ accountDisabled = false }: { accountDisabled?: boolean }) {
  const { t } = useLocale();
  const [cursors, setCursors] = useState<string[]>([]);
  const [data, setData] = useState<SupportersDirectory | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(!accountDisabled);
  const [revision, setRevision] = useState(0);
  const cursor = cursors.at(-1);
  useEffect(() => {
    if (accountDisabled) return;
    let live = true;
    setBusy(true); setError(null); setData(null);
    api<SupportersDirectory>('supporters?limit=24' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''))
      .then(value => { if (live) setData(value); })
      .catch(value => { if (live) setError(value); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [accountDisabled, cursor, revision]);
  useEffect(() => {
    if (accountDisabled) return;
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(value => value + 1); };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, [accountDisabled]);
  const disabled = accountDisabled || (error instanceof ApiFailure && error.code === 'account_service_disabled');
  return <>
    <div className="page-heading supporters-heading">
      <span className="eyebrow">{t('POWERED BY PLAYERS')}</span>
      <h1>{t('Supporters')}</h1>
      <p>{t('Thank you for keeping an open game growing.')}</p>
      <p className="muted">{t('Every paid month counts. Recognition stays after Hero expires.')}</p>
      <Link className="button primary" href="/supporter">{t('Support the game')} <span aria-hidden="true">→</span></Link>
    </div>
    <section className="card supporters-card" aria-label={t('Supporters')} aria-busy={busy}>
      <div className="section-heading"><h2>{t('Our community')}</h2>{!disabled && <button disabled={busy} onClick={() => setRevision(value => value + 1)}>{t('Refresh')}</button>}</div>
      <p className="muted">{t('Only players who choose public recognition appear here. Profile statistics follow each player’s privacy settings.')}</p>
      {disabled ? <p className="notice" role="status">{t('The supporter directory is unavailable in this guest prototype. Accounts and payments are not enabled here.')}</p> : error ? <p className="notice error" role="alert">{t('The supporter directory could not be loaded. Please try again.')} <button onClick={() => setRevision(value => value + 1)}>{t('Try again')}</button></p> : busy ? <p role="status">{t('Loading supporters…')}</p> : data?.supporters.length === 0 ? <p className="empty" role="status">{cursors.length ? t('No supporters on this page. Return to the previous page.') : t('No public supporters yet. Recognition is always optional.')}</p> : null}
      {data && !busy && <ul className="supporters-list">{data.supporters.map(supporter => <li className="supporter-row" key={supporter.profile_id}>
        <Link className="supporter-player" href={'/players/' + supporter.profile_id}>
          <span className="avatar" aria-hidden="true">{Array.from(supporter.nickname)[0]}</span>
          <span><strong>{supporter.nickname}</strong><small>{t('View game profile')} <span aria-hidden="true">↗</span></small></span>
        </Link>
        <HeroRecognitionBadge recognition={supporter} />
      </li>)}</ul>}
      {!disabled && (cursors.length > 0 || data?.next_cursor) && <nav className="supporters-pagination" aria-label={t('Supporter pages')}>
        <button disabled={busy || cursors.length === 0} onClick={() => setCursors(value => value.slice(0, -1))}>{t('Back')}</button>
        <button disabled={busy || !data?.next_cursor} onClick={() => { if (data?.next_cursor) setCursors(value => [...value, data.next_cursor!]); }}>{t('Next')}</button>
      </nav>}
    </section>
  </>;
}
