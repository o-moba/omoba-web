import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { cookieOptions, expireCookie, mutationAllowed, portalConfig } from '@/lib/security.mjs';
import { LINK_TOKEN, ekzaConfig, parseDeviceStart, parsePoll } from '@/lib/ekza-link.mjs';
import { contourHostProblem, contourName, requestHostname } from '@/lib/contour.mjs';
import { marketFeatures } from '@/lib/market-profile.mjs';
import { RegistryUnavailable, registryRequest, revokeLink } from '@/lib/market-server.mjs';
import { PLACEMENT_SCOPE, parseOwnPlacements, parsePlacement, parsePlacementRequest, sponsorCookieNames, sponsorRoute } from '@/lib/sponsor.mjs';
import { loadSponsor } from '@/lib/sponsor-server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });
const fail = (code: string, status: number) => reply({ code }, status);
const ekzaEnabled = () => { try { return marketFeatures().ekza; } catch { return false; } };

/** Bounded JSON before parsing; no arbitrary request body is forwarded upstream. */
async function body(request: NextRequest) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) throw new Error('body');
  if (Number(request.headers.get('content-length') ?? 0) > 8192) throw new Error('body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new Error('body'); }
    chunks.push(next.value);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
}

async function hasBody(request: NextRequest) {
  // Next may expose an empty stream for a POST with Content-Length: 0.
  const reader = request.body?.getReader();
  if (!reader) return false;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return false;
    if (chunk.value.byteLength) { await reader.cancel(); return true; }
  }
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  // Without the Ekza feature (ru, cn) this BFF does not exist: no cookie is read and
  // no Registry is contacted. A misconfigured market answers the same way.
  if (!ekzaEnabled()) return fail('not_found', 404);
  let portal: ReturnType<typeof portalConfig>;
  let ekza: ReturnType<typeof ekzaConfig> | null = null;
  try { portal = portalConfig(); } catch { return fail('configuration_unavailable', 503); }
  if (contourHostProblem(contourName(), requestHostname(request.headers.get('host')))) return fail('configuration_unavailable', 503);
  const route = sponsorRoute((await context.params).path.join('/'), request.method);
  if (!route) return fail('not_found', 404);
  if (request.nextUrl.search) return fail('invalid_query', 400);
  try { ekza = ekzaConfig(); } catch {}
  const jar = await cookies();
  const names = sponsorCookieNames(portal.secure);
  const options = cookieOptions(portal.secure);
  const clear = (...keys: string[]) => keys.forEach(key => expireCookie(jar, key, portal.secure));
  if (route.action === 'csrf') {
    const token = jar.get(names.csrf)?.value || randomBytes(32).toString('hex');
    jar.set(names.csrf, token, { ...options, maxAge: 86400 });
    return reply({ token });
  }
  if (request.method !== 'GET' && !mutationAllowed(request.headers.get('origin'), portal.origin,
    request.headers.get('x-csrf-token'), jar.get(names.csrf)?.value)) return fail('csrf_rejected', 403);
  // Only creation accepts a body. An injected price/hash/approval is never forwarded.
  if (route.action !== 'create' && await hasBody(request)) return fail('invalid_request', 400);
  const stored = jar.get(names.link)?.value;
  const token = stored && LINK_TOKEN.test(stored) ? stored : undefined;
  if (route.action === 'sign-out') {
    const revoked = token ? (ekza ? await revokeLink(ekza.registry, token) : false) : null;
    clear(names.link, names.device, names.csrf);
    return reply({ status: 'signed_out', revoked });
  }
  if (!ekza) return fail('configuration_unavailable', 503);
  const registry = ekza.registry;
  try {
    if (route.action === 'public') {
      const result = await loadSponsor();
      return result.state === 'ready' ? reply(result) : fail('registry_unavailable', 503);
    }
    if (route.action === 'device') {
      const upstream = await registryRequest(registry, '/v1/account/device', { method: 'POST', body: { projectId: 'omoba', scope: PLACEMENT_SCOPE } });
      if (![200, 201].includes(upstream.status)) return failure(upstream);
      let device;
      try { device = parseDeviceStart(upstream.json, ekza.studio); } catch { return fail('invalid_service_response', 502); }
      jar.set(names.device, device.deviceCode, { ...options, maxAge: device.maxAge });
      return reply({ status: 'pending', ...device.browser });
    }
    if (route.action === 'device/poll') {
      const deviceCode = jar.get(names.device)?.value;
      if (!deviceCode || !/^[A-Za-z0-9_-]{32,128}$/.test(deviceCode)) return fail('device_expired', 410);
      const upstream = await registryRequest(registry, '/v1/account/device/poll', { method: 'POST', body: { deviceCode } });
      if (upstream.status !== 200) return failure(upstream);
      let result;
      try { result = parsePoll(upstream.json); } catch { clear(names.device); return fail('invalid_service_response', 502); }
      if (result.status === 'pending') return reply({ status: 'pending' });
      clear(names.device);
      // Missing/legacy or market scope never becomes a placement session.
      if (result.scope !== PLACEMENT_SCOPE) { clear(names.link); return fail('link_scope', 403); }
      jar.set(names.link, result.accessToken, { ...options, maxAge: result.maxAge });
      return reply({ status: 'connected' });
    }
    if (!token) { if (stored) clear(names.link); return fail('link_expired', 401); }
    if (route.action === 'placements') {
      const upstream = await registryRequest(registry, '/v1/account/placements', { token });
      if (upstream.status !== 200) return failure(upstream);
      try { return reply({ items: parseOwnPlacements(upstream.json, registry) }); } catch { return fail('invalid_service_response', 502); }
    }
    let path: string;
    let payload;
    if (route.action === 'create') {
      try { payload = parsePlacementRequest(await body(request)); } catch { return fail('invalid_request', 400); }
      path = '/v1/account/placements';
    } else if (route.action === 'cancel') {
      path = '/v1/account/placements/' + route.id + '/cancel';
    } else return fail('not_found', 404);
    const upstream = await registryRequest(registry, path, { method: 'POST', token, ...(payload ? { body: payload } : {}) });
    if (![200, 201].includes(upstream.status)) return failure(upstream);
    try { return reply(parsePlacement(upstream.json, registry, true)); } catch { return fail('invalid_service_response', 502); }
  } catch (error) {
    if (error instanceof RegistryUnavailable) return fail('registry_unavailable', 503);
    throw error;
  }
  function failure(upstream: { status: number; json: unknown; headers: Headers }) {
    const source = upstream.json as { error?: { code?: unknown } } | null;
    const code = typeof source?.error?.code === 'string' ? source.error.code : '';
    if (upstream.status === 401) { clear(names.link); return fail('link_expired', 401); }
    if (upstream.status === 403 && code === 'link_scope') { clear(names.link); return fail('link_scope', 403); }
    if (upstream.status === 410) { clear(names.device); return fail('device_expired', 410); }
    if (upstream.status === 429) {
      const response = fail('rate_limited', 429);
      const retry = upstream.headers.get('retry-after');
      if (retry && /^\d{1,4}$/.test(retry)) response.headers.set('Retry-After', retry);
      return response;
    }
    if (['asset_not_available', 'slot_not_found', 'slot_occupied', 'placement_limit', 'idempotency_conflict', 'placement_not_found', 'placement_decided', 'payments_disabled'].includes(code) && [403, 404, 409, 422, 503].includes(upstream.status)) return fail(code, upstream.status);
    if (route?.action === 'device' && [404, 405, 422].includes(upstream.status)) return fail('placements_unsupported', 503);
    return fail('registry_unavailable', upstream.status >= 500 ? 503 : 502);
  }
}
export { handle as GET, handle as POST };
