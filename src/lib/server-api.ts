import 'server-only';
import { cookies, headers } from 'next/headers';
import { OPAQUE_SECRET, accountUpstreamHeaders, cookieNames, portalConfig } from './security.mjs';
import { marketFeatures } from './market-profile.mjs';

export async function initialAccount() {
  try {
    const config = portalConfig();
    if (!config.accountEnabled) return { account: null, unavailable: false, disabled: true };
    const token = (await cookies()).get(cookieNames(config.secure).session)?.value;
    if (!token) return { account: null, unavailable: false };
    const forwarded = accountUpstreamHeaders((await headers()).get('x-real-ip'));
    if (!forwarded) throw new Error('Trusted ingress required');
    forwarded.Authorization = 'Bearer ' + token;
    const response = await fetch(config.api+'/v1/me', {
      headers: forwarded, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return { account: null, unavailable: false };
    if (!response.ok) return { account: null, unavailable: true };
    return { account: await response.json(), unavailable: false };
  } catch { return { account: null, unavailable: true }; }
}

export type SocialTicket = { display_name: string; expires_at: string };

/**
 * A VK ID sign-in that is not linked to a game profile yet leaves a ticket in an
 * HttpOnly cookie. Its display name ("Иван П.") is read server-to-server; the
 * ticket itself never reaches the page. Null without the feature or a valid ticket.
 */
export async function initialSocialTicket(): Promise<SocialTicket | null> {
  try {
    const config = portalConfig();
    if (!config.accountEnabled || !marketFeatures().vkSignIn) return null;
    const ticket = (await cookies()).get(cookieNames(config.secure).social)?.value;
    if (!ticket || !OPAQUE_SECRET.test(ticket)) return null;
    const forwarded = accountUpstreamHeaders((await headers()).get('x-real-ip'));
    if (!forwarded) return null;
    forwarded['Content-Type'] = 'application/json';
    const response = await fetch(config.api + '/v1/auth/social/ticket', {
      method: 'POST', headers: forwarded, body: JSON.stringify({ social_ticket: ticket }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const value = await response.json() as Partial<SocialTicket>;
    if (typeof value.display_name !== 'string' || !value.display_name.trim() || value.display_name.length > 40 || typeof value.expires_at !== 'string') return null;
    return { display_name: value.display_name, expires_at: value.expires_at };
  } catch { return null; }
}
