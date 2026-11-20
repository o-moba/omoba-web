'use client';
import { useLocale } from '@/components/locale-provider';
import { useMarket } from '@/components/market-profile';
import { fill } from '@/components/social';
import { legalSourceUrl } from '@/lib/legal.mjs';
import { releasePlatform, releaseSize, releaseStatus, type Release } from '@/lib/releases.mjs';

/**
 * One download (LR-22): platform, version, the market's release status and the size in
 * the page language (`Открытая бета · 312,4 МБ`), the package link, the source of its
 * release (where the market publishes one, LR-06) and its SHA-256 in plain sight.
 */
export function ReleaseCard({ release, highlighted = false }: { release: Release; highlighted?: boolean }) {
  const { t, locale } = useLocale();
  const { legal } = useMarket();
  const platform = releasePlatform(release.platform);
  const source = legalSourceUrl(legal, release.version);
  return <section className={'card release-card' + (highlighted ? ' highlighted' : '')} data-release={release.platform}>
    <span className="eyebrow">{platform} · {release.architecture}</span>
    <h2>{release.version}</h2>
    {release.instructions ? <p>{release.instructions}</p> : null}
    <p className="muted"><span data-release-status>{releaseStatus(release.test_status, locale)}</span> · <span data-release-size>{releaseSize(release.size_bytes, locale)}</span></p>
    <div className="release-actions">
      <a className="button primary" href={release.url} rel="noreferrer" data-release-download>{fill(t('Download for {platform}'), { platform })} ↗</a>
      {source ? <a className="button" href={source} rel="noreferrer noopener" data-release-source>{t('Source code of this version')} ↗</a> : null}
    </div>
    <p className="code release-sha">SHA-256 <span data-release-sha256>{release.sha256}</span></p>
  </section>;
}

/** The downloads of a page, the requested platform (`?platform=`, the game's update button) first. */
export function ReleaseList({ releases, platform = null }: { releases: Release[]; platform?: string | null }) {
  const first = platform ? [...releases].sort((a, b) => Number(b.platform === platform) - Number(a.platform === platform)) : releases;
  return <div className="release-list">{first.map(release => <ReleaseCard key={release.platform + release.architecture + release.version} release={release} highlighted={release.platform === platform}/>)}</div>;
}
