import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { cookieOptions, expireCookie, mutationAllowed, portalConfig } from '@/lib/security.mjs';
import { EKZA_LINK_SCOPE, LINK_TOKEN, ekzaConfig, ekzaCookieNames, ekzaRoute, parseDeviceStart, parseLibrary, parsePoll, upstreamFailure } from '@/lib/ekza-link.mjs';
import { MARKET_PROJECT } from '@/lib/market.mjs';
import { RegistryUnavailable, registryRequest, revokeLink } from '@/lib/market-server.mjs';

// Ekza Library BFF for /market. Independent of the OMOBA Account API, so it also
// works with OMOBA_ACCOUNT_MODE=disabled. The Registry link token stays in an
// HttpOnly cookie and is never part of a response body.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
function reply(value: Record<string, unknown>, status = 200) { return NextResponse.json(value, { status, headers: noStore }); }
function fail(code: string, status: number) { return reply({ code }, status); }

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  let portal: ReturnType<typeof portalConfig>, ekza: ReturnType<typeof ekzaConfig> | null = null;
  try { portal = portalConfig(); } catch { return fail('configuration_unavailable', 503); }
  // A wrong Registry override still lets the player clear their cookies.
  try { ekza = ekzaConfig(); } catch {}
  const route = ekzaRoute((await context.params).path.join('/'), request.method);
  if (!route) return fail('not_found', 404);
  const jar = await cookies();
  const names = ekzaCookieNames(portal.secure);
  const options = cookieOptions(portal.secure);
  // Expiry keeps Secure: a browser ignores a `__Host-` deletion without it.
  const clear = (...list: string[]) => { for (const name of list) expireCookie(jar, name, portal.secure); };
  if (route.action === 'csrf') {
    const token = jar.get(names.csrf)?.value || randomBytes(32).toString('hex');
    jar.set(names.csrf, token, { ...options, maxAge: 86400 });
    return reply({ token });
  }
  if (request.method !== 'GET' && !mutationAllowed(request.headers.get('origin'), portal.origin,
    request.headers.get('x-csrf-token'), jar.get(names.csrf)?.value)) return fail('csrf_rejected', 403);
  if (request.nextUrl.search) return fail('invalid_query', 400);
  // No browser body, header or query is forwarded; each action builds its own request.
  const token = jar.get(names.link)?.value;
  const linked = token && LINK_TOKEN.test(token) ? token : undefined;
  if (route.action === 'sign-out') {
    // End this link in the Registry first (C7), best effort; the cookies go regardless.
    const revoked = linked ? (ekza ? await revokeLink(ekza.registry, linked) : false) : null;
    clear(names.link, names.device, names.csrf);
    return reply({ status: 'signed_out', revoked });
  }
  if (!ekza) return fail('configuration_unavailable', 503);
  try {
    if (route.action === 'start') {
      const upstream = await registryRequest(ekza.registry, '/v1/account/device', {
        method: 'POST', body: { projectId: MARKET_PROJECT, scope: EKZA_LINK_SCOPE },
      });
      if (upstream.status !== 200 && upstream.status !== 201) return failure(route.action, upstream);
      let device: ReturnType<typeof parseDeviceStart>;
      try { device = parseDeviceStart(upstream.json, ekza.studio); } catch { return fail('invalid_service_response', 502); }
      jar.set(names.device, device.deviceCode, { ...options, maxAge: device.maxAge });
      return reply({ status: 'pending', ...device.browser });
    }
    if (route.action === 'poll') {
      const deviceCode = jar.get(names.device)?.value;
      if (!deviceCode || !/^[A-Za-z0-9_-]{32,128}$/.test(deviceCode)) return fail('device_expired', 410);
      const upstream = await registryRequest(ekza.registry, '/v1/account/device/poll', {
        method: 'POST', body: { deviceCode },
      });
      if (upstream.status !== 200) return failure(route.action, upstream);
      let result: ReturnType<typeof parsePoll>;
      try { result = parsePoll(upstream.json); } catch { clear(names.device); return fail('invalid_service_response', 502); }
      if (result.status === 'pending') return reply({ status: 'pending' });
      clear(names.device);
      // A link that cannot add items is not stored; the player signs in again.
      if (result.scope !== null && result.scope !== EKZA_LINK_SCOPE) return fail('link_scope', 403);
      jar.set(names.link, result.accessToken, { ...options, maxAge: result.maxAge });
      return reply({ status: 'connected', account: { username: result.username }, expiresAt: result.expiresAt });
    }
    if (!linked) {
      if (token) clear(names.link);
      return fail('link_expired', 401);
    }
    if (route.action === 'library') {
      const upstream = await registryRequest(ekza.registry, '/v1/account/library', { token: linked });
      if (upstream.status !== 200) return failure(route.action, upstream);
      let library: ReturnType<typeof parseLibrary>;
      try { library = parseLibrary(upstream.json); } catch { return fail('invalid_service_response', 502); }
      return reply({ status: 'connected', account: { username: library.username }, expiresAt: library.expiresAt, owned: library.owned });
    }
    if (route.action !== 'claim' && route.action !== 'unclaim') return fail('not_found', 404);
    const upstream = await registryRequest(ekza.registry, '/v1/account/library/' + route.assetId, {
      method: route.action === 'claim' ? 'POST' : 'DELETE', token: linked,
    });
    if (route.action === 'unclaim') {
      if (upstream.status !== 204 && upstream.status !== 200) return failure(route.action, upstream);
      return reply({ status: 'removed', assetId: route.assetId });
    }
    if (upstream.status !== 200) return failure(route.action, upstream);
    const status = (upstream.json as { status?: unknown } | null)?.status;
    if (status !== 'claimed' && status !== 'owned') return fail('invalid_service_response', 502);
    return reply({ status, assetId: route.assetId });
  } catch (error) {
    if (error instanceof RegistryUnavailable) return fail('registry_unavailable', 503);
    throw error;
  }

  function failure(action: string, upstream: { status: number; json: unknown; headers: Headers }) {
    const mapped = upstreamFailure(action, upstream.status, upstream.json);
    if (mapped.clearLink) clear(names.link);
    if (mapped.clearDevice) clear(names.device);
    const response = fail(mapped.code, mapped.status);
    const retry = upstream.headers.get('retry-after');
    if (retry && /^\d{1,4}$/.test(retry)) response.headers.set('Retry-After', retry);
    return response;
  }
}
export { handle as GET, handle as POST, handle as DELETE };
