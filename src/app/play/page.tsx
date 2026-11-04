import { initialAccount, initialSocialTicket } from '@/lib/server-api';
import { contourSiteUrl } from '@/lib/navigation.mjs';
import { BrowserPlay } from '@/components/browser-play';
import './play.css';

export const dynamic = 'force-dynamic';
export default async function PlayPage() {
  const state = await initialAccount();
  const social = state.account || state.disabled ? null : await initialSocialTicket();
  return <BrowserPlay displayName={state.account?.profile?.nickname ?? null}
    socialName={social?.display_name ?? null}
    accountDisabled={state.disabled === true} accountUnavailable={state.unavailable}
    siteUrl={contourSiteUrl()} />;
}
