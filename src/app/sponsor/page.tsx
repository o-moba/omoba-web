import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { marketFeatures } from '@/lib/market-profile.mjs';
import { cookies } from 'next/headers';
import Sponsor from '@/components/sponsor';
import { portalConfig } from '@/lib/security.mjs';
import { LINK_TOKEN, ekzaConfig, studioOrigin } from '@/lib/ekza-link.mjs';
import { sculptureDraftUrl, sponsorCookieNames } from '@/lib/sponsor.mjs';
import { loadSponsor, readSponsorSession } from '@/lib/sponsor-server.mjs';
import { contourSiteUrl } from '@/lib/navigation.mjs';
import type { SponsorSession } from '@/lib/sponsor-types';
import '../creators/creators.css';
import '../market/market.css';
import './sponsor.css';

export const metadata: Metadata = { title: 'Community sculptures · OMOBA', description: 'Place a reviewed community sculpture on the OMOBA map for 24 hours. Free during the pilot.' };
async function session(): Promise<SponsorSession> {
  try {
    const { secure } = portalConfig();
    const { registry } = ekzaConfig();
    const token = (await cookies()).get(sponsorCookieNames(secure).link)?.value;
    if (!token) return { state: 'guest' };
    if (!LINK_TOKEN.test(token)) return { state: 'expired' };
    return readSponsorSession(registry, token);
  } catch { return { state: 'unavailable' }; }
}
export default async function SponsorPage() {
  await connection();
  // Registry-served map placements are part of the Ekza feature.
  if (!marketFeatures().ekza) notFound();
  const [data, initialSession] = await Promise.all([loadSponsor(), session()]);
  const studio = studioOrigin();
  return <Sponsor initialData={data} initialSession={initialSession} uploadUrl={studio ? sculptureDraftUrl(studio) : null} siteUrl={contourSiteUrl()} />;
}
