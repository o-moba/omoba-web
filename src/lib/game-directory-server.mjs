// Public fixed-origin transport, separate from the authenticated account BFF.
// Rust verifies the published signature/schema; native clients independently
// verify their baked pin. Forward exact bytes, never browser credentials.
import { accountIngressHeaders, portalConfig } from './security.mjs';
import { contourName } from './contour.mjs';
import { marketName } from './market-profile.mjs';

export const MAX_DIRECTORY_BYTES = 65536;
const MAX_PAYLOAD_BYTES = 49152;
const TIMEOUT_MS = 5000;
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function failure(status = 503, code = 'game_directory_unavailable') {
  return new Response(JSON.stringify({ code }), { status, headers });
}

/** Anonymous GET/HEAD; test injection changes no runtime configuration. */
export async function gameDirectoryResponse(request, env = process.env, fetchImpl = fetch) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  let upstream;
  try {
    const url = new URL(request.url);
    if (url.pathname !== '/api/game/directory') return failure(404, 'not_found');
    if (url.search) return failure(400, 'invalid_request');
    const market = marketName(env), contour = contourName(env), config = portalConfig(env);
    if (!['ru', 'global'].includes(market) || !config.accountEnabled) return failure();
    // Behind a loopback listener, Host is the public ingress authority. A
    // browser's forwarding headers never choose the authority or upstream.
    const host = request.headers.get('host') || url.host;
    if (host.toLowerCase() !== new URL(config.origin).host.toLowerCase()) return failure(404, 'not_found');
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    upstream = await fetchImpl(config.api + '/v1/game-directory', {
      method: 'GET', headers: { Accept: 'application/json', ...accountIngressHeaders(env) },
      credentials: 'omit', redirect: 'error', cache: 'no-store', signal,
    });
    if (!upstream.ok || !/^application\/json(?:\s*;|$)/i.test(upstream.headers.get('content-type') || '')) {
      await upstream.body?.cancel().catch(() => {}); return failure();
    }
    const advertised = upstream.headers.get('content-length');
    if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > MAX_DIRECTORY_BYTES)) {
      await upstream.body?.cancel().catch(() => {}); return failure();
    }
    const reader = upstream.body?.getReader();
    if (!reader) return failure();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DIRECTORY_BYTES) { await reader.cancel().catch(() => {}); return failure(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!envelope || Object.keys(envelope).sort().join(',') !== 'key_id,payload,signature'
      || typeof envelope.key_id !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(envelope.key_id)
      || typeof envelope.payload !== 'string' || new TextEncoder().encode(envelope.payload).length > MAX_PAYLOAD_BYTES
      || typeof envelope.signature !== 'string' || !/^[a-f0-9]{128}$/.test(envelope.signature)) return failure();
    // Publication/schema/signature validation belongs to Rust. These checks
    // stop a miswired portal serving another account region or stale document.
    const doc = JSON.parse(envelope.payload), now = Date.now();
    if (!doc || doc.version !== 1 || doc.region !== market || doc.contour !== contour
      || !Number.isSafeInteger(doc.issued_at_ms) || !Number.isSafeInteger(doc.expires_at_ms)
      || doc.issued_at_ms < 0 || doc.issued_at_ms > now + 30000 || doc.expires_at_ms <= now
      || doc.expires_at_ms <= doc.issued_at_ms || doc.expires_at_ms - doc.issued_at_ms > 7 * 86400000) return failure();
    return new Response(request.method === 'HEAD' ? null : bytes, { status: 200, headers });
  } catch {
    await upstream?.body?.cancel().catch(() => {});
    return failure();
  }
}
