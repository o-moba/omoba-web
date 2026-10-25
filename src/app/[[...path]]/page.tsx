import type { Metadata } from 'next';
import { contourSiteUrl } from "@/lib/navigation.mjs";
import { initialAccount, initialSocialTicket } from '@/lib/server-api';
import { landingFacts, landingReleases } from '@/lib/landing-server';
import { getLocale } from '@/lib/locale-server';
import { landingMetadata } from '@/lib/landing-translations';
import { contourName } from '@/lib/contour.mjs';
import { portalConfig } from '@/lib/security.mjs';
import { marketFeatures, marketLanding, marketLocale, marketName, routeEnabled } from '@/lib/market-profile.mjs';
import Portal from '@/components/portal';
import { notFound, redirect } from 'next/navigation';
export const dynamic='force-dynamic';

/**
 * Where the market's landing is this portal (`marketLanding`, RU: LR-22), `/` is that
 * landing: titled for search, indexable in production only, its language as hreflang.
 * Every other page keeps the layout's noindex.
 */
export async function generateMetadata({params}:{params:Promise<{path?:string[]}>}): Promise<Metadata> {
  if ((await params).path?.length) return {};
  const market = marketName();
  if (marketLanding(market).home !== 'portal') return {};
  const home = new URL('/', portalConfig().origin).href, language = marketLocale(market);
  return {
    ...landingMetadata(await getLocale(), (await landingFacts()).classes),
    robots: contourName() === 'production' ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: home, ...(language ? { languages: { [language]: home } } : {}) },
  };
}

export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  const path=(await params).path;
  if (!path?.length) {
    // The market's landing is elsewhere (the OMOBA website): `/` opens the class workshop.
    if (marketLanding(marketName()).home !== 'portal') redirect('/workshop');
    const initial = await initialAccount();
    if (initial.account) redirect('/me');
    const [facts, releases] = await Promise.all([landingFacts(), landingReleases()]);
    return <Portal siteUrl={contourSiteUrl()} initialAccount={null} initiallyUnavailable={initial.unavailable} accountDisabled={initial.disabled === true} home={{facts, ...releases}}/>;
  }
  // Supporter pages exist only in markets that sell Hero (not ru, cn).
  if (!routeEnabled('/'+path.join('/'), marketFeatures())) notFound();
  const initial=await initialAccount();
  // An unlinked VK ID sign-in only matters without a session.
  const socialTicket=initial.account||initial.disabled ? null : await initialSocialTicket();
  return <Portal siteUrl={contourSiteUrl()} initialAccount={initial.account} initiallyUnavailable={initial.unavailable} accountDisabled={initial.disabled === true} socialTicket={socialTicket}/>;
}
