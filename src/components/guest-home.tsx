'use client';
import Link from 'next/link';
import { useLocale } from '@/components/locale-provider';
import { useMarket } from '@/components/market-profile';
import { ReleaseList } from '@/components/releases';
import { dictionaries } from '@/lib/i18n';
import { classesClaim } from '@/lib/landing-translations';
import { releaseStatus, type Release } from '@/lib/releases.mjs';

export type GuestHomeData = { facts: { classes: number }; releases: Release[]; unavailable: boolean };

/** The game's four ways to play, named as the game names them (client/i18n queue.json, home.json). */
const MODES = [
  ['Ranked', 'Ten players, rated, never filled with bots.'],
  ['Casual PvP', 'Everyone searching plays together; bots fill the empty seats. Unrated, earns experience.'],
  ['vs Bots', 'You or your party against server bots.'],
  ['Offline practice', 'Every class on your device, without a server or an account.'],
] as const;

/**
 * The guest home: a market's landing on this portal (`marketLanding`, RU: LR-22). Every
 * claim is counted or named from the game (hero classes from its catalog snapshot, the
 * map and the modes as the game shows them), the downloads come from the market's release
 * catalog with SHA-256 and size, and the age sign comes from the market's legal table.
 * Legal documents, support and community links are in the page footer.
 */
export function GuestHome({ home, loginHref, signInLabel }: { home: GuestHomeData; loginHref: string; signInLabel: string }) {
  const { t, locale } = useLocale();
  const { features, legal } = useMarket();
  const w = dictionaries[locale];
  const status = home.releases[0] ? releaseStatus(home.releases[0].test_status, locale) : null;
  return <div className="landing" data-guest-home>
    <section className="card portal-welcome landing-hero">
      <div className="portal-welcome-copy">
        <span className="eyebrow">{t('FREE · OPEN SOURCE · 5V5')}</span>
        <h1>{t('Five against five on the Verdant Arena.')}</h1>
        <p className="landing-lead" data-landing-claim>{classesClaim(locale, home.facts.classes)} {t('Ranked and casual matches with other players, games against bots and offline practice.')}</p>
        <div className="landing-actions">
          <a className="button primary" href="#download">{t('Download the game')} ↓</a>
          <Link className="button" href={loginHref}>{signInLabel} →</Link>
        </div>
        <p className="landing-badges">
          {status ? <span className="tag" title={t('Release status')} data-landing-status>{status}</span> : null}
          {legal.ageRating ? <span className="age-sign" title={t('Age rating')} aria-label={t('Age rating') + ' ' + legal.ageRating} data-age-rating>{legal.ageRating}</span> : null}
        </p>
      </div>
      <figure className="portal-welcome-art">
        <img src="/art/supporter/spellblade.webp" alt={t('OMOBA spellblade illustration')} width={1024} height={1024}/>
        <figcaption>{t('OMOBA concept art · not an in-game skin')}</figcaption>
      </figure>
    </section>
    <section className="landing-section" aria-labelledby="landing-modes">
      <h2 id="landing-modes">{t('Modes')}</h2>
      <div className="landing-modes">{MODES.map(([name, description]) => <section className="card" key={name} data-landing-mode><h3>{t(name)}</h3><p className="muted">{t(description)}</p></section>)}</div>
    </section>
    <section className="landing-section" id="download" aria-labelledby="landing-download">
      <div className="section-heading"><h2 id="landing-download">{t('Download')}</h2><Link href="/download">{t('All downloads')} →</Link></div>
      {home.unavailable ? <p role="status" className="notice">{t('The download list is unavailable right now. Try again later.')}</p>
        : home.releases.length === 0 ? <p className="notice">{w.noRelease}</p>
        : <><ReleaseList releases={home.releases}/><p className="muted">{t('Check the file you downloaded: its SHA-256 must match the one shown here.')}</p></>}
    </section>
    <section className="card landing-section" aria-labelledby="landing-account">
      <h2 id="landing-account">{t('Your progress')}</h2>
      <p className="muted">{features.vkSignIn
        ? t('Sign in here with VK, OK or Mail.ru to create your profile, then use the same account in the game: Profile → Sign in with VK ID. Already playing? Link your existing profile from the game first to keep your progress.')
        : t('The game creates your profile when you first start it. To see your matches here, connect the game to this site: Profile → Link or recover account.')}</p>
      <Link className="button" href={loginHref}>{signInLabel} →</Link>
    </section>
  </div>;
}
