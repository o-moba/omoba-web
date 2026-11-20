import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { accountUpstreamHeaders, cookieNames, portalConfig, mutationAllowed } from './security.mjs';
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

/** The widget's two POSTs use the same origin/CSRF proof as all portal mutations. */
export async function vkJsonBody(request: NextRequest, context: VkContext, keys: readonly string[]) {
  if (!mutationAllowed(request.headers.get('origin'), context.config.origin,
    request.headers.get('x-csrf-token'), request.cookies.get(context.names.csrf)?.value)) return fail('csrf_rejected', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail('json_required', 400);
  if (Number(request.headers.get('content-length') || 0) > 8192) return fail('body_too_large', 413);
  const reader = request.body?.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); return fail('body_too_large', 413); }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) return fail('invalid_json', 400);
    return value as Record<string, unknown>;
  } catch { return fail('invalid_json', 400); }
}
