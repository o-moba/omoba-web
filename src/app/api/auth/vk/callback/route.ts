import type { NextRequest } from 'next/server';
import { vkCallback, vkFailureLocation } from '@/lib/vk-id.mjs';
import { redirectWith, upstreamHeaders, vkContext } from '@/lib/vk-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `GET /api/auth/vk/callback`: VK ID's redirect. The portal does not exchange the
 * code; it forwards code, verifier, device id and state to the Account API, which
 * answers with a session (signed in) or a ticket (VK account not linked yet).
 */
export async function GET(request: NextRequest) {
  const context = vkContext(request);
  if (!('clientId' in context)) return context;
  const { config, names, features } = context;
  const cookie = request.cookies.get(names.vk)?.value;
  const headers = upstreamHeaders(request);
  if (!headers || request.nextUrl.search.length > 8192)
    return redirectWith(vkFailureLocation(headers ? 'failed' : 'unavailable', '/me'), config.origin, { set: [], clear: cookie === undefined ? [] : [names.vk] }, config.secure);
  const result = await vkCallback({
    api: config.api,
    origin: config.origin,
    names,
    features,
    query: request.nextUrl.searchParams,
    cookie,
    headers,
  });
  return redirectWith(result.location, config.origin, result.cookies, config.secure);
}
