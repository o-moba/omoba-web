import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { accountUpstreamHeaders, cookieNames, portalConfig } from './security.mjs';
import { contourHostProblem, contourName, requestHostname } from './contour.mjs';
import { marketFeatures, vkSignInClientId } from './market-profile.mjs';
import { applyCookies, type CookieChanges } from './vk-id.mjs';

export const noStore = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
export function fail(code: string, status: number) { return NextResponse.json({ code }, { status, headers: noStore }); }

export type VkContext = {
  config: ReturnType<typeof portalConfig>;
  clientId: string;
  features: ReturnType<typeof marketFeatures>;
  names: ReturnType<typeof cookieNames>;
};

/**
 * VK ID routes exist only when the market has `vkSignIn` and an app id is set;
 * otherwise they answer 404 `not_found` before reading any cookie.
 */
export function vkContext(request: NextRequest): VkContext | NextResponse {
  let clientId: string | null, features: ReturnType<typeof marketFeatures>, config: ReturnType<typeof portalConfig>;
  try { clientId = vkSignInClientId(); features = marketFeatures(); } catch { return fail('configuration_unavailable', 503); }
  if (!clientId) return fail('not_found', 404);
  try { config = portalConfig(); } catch { return fail('configuration_unavailable', 503); }
  if (contourHostProblem(contourName(), requestHostname(request.headers.get('host')))) return fail('configuration_unavailable', 503);
  if (!config.accountEnabled) return fail('account_service_disabled', 503);
  return { config, clientId, features, names: cookieNames(config.secure) };
}

/** Server-to-server headers, as the BFF sends them (ingress key, trusted client IP). */
export function upstreamHeaders(request: NextRequest): Record<string, string> | null {
  return accountUpstreamHeaders(request.headers.get('x-real-ip'));
}

/** A 302 that carries cookie changes; relative locations stay on the portal origin. */
export function redirectWith(location: string, origin: string, cookies: CookieChanges, secure: boolean) {
  const response = NextResponse.redirect(new URL(location, origin), 302);
  applyCookies(response.cookies, cookies, secure);
  for (const [key, value] of Object.entries(noStore)) response.headers.set(key, value);
  return response;
}
