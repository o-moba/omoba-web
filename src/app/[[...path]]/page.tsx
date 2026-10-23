import { contourSiteUrl } from "@/lib/navigation.mjs";
import { initialAccount, initialSocialTicket } from '@/lib/server-api';
import { marketFeatures, routeEnabled } from '@/lib/market-profile.mjs';
import Portal from '@/components/portal';
import { notFound, redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  const path=(await params).path;
  if (!path?.length) redirect('/workshop');
  // Supporter pages exist only in markets that sell Hero (not ru, cn).
  if (!routeEnabled('/'+path.join('/'), marketFeatures())) notFound();
  const initial=await initialAccount();
  // An unlinked VK ID sign-in only matters without a session.
  const socialTicket=initial.account||initial.disabled ? null : await initialSocialTicket();
  return <Portal siteUrl={contourSiteUrl()} initialAccount={initial.account} initiallyUnavailable={initial.unavailable} accountDisabled={initial.disabled === true} socialTicket={socialTicket}/>;
}
