import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { accountUpstreamHeaders, allowedPath, cookieNames, cookieOptions, expireCookie, mutationAllowed, portalConfig, socialTicketBody } from '@/lib/security.mjs';
import { marketFeatures, marketName, paymentProviders } from '@/lib/market-profile.mjs';
import { CHECKOUT_COOKIE_SECONDS, CHECKOUT_PATH, PAYMENTS_PATH, attemptFinished, attemptId, checkoutAttempt, checkoutCookie, checkoutFingerprint, checkoutFinished, checkoutRequest, confirmationUrl, parseCheckoutCookie } from '@/lib/checkout-attempt.mjs';
import { contourHostProblem, contourName, requestHostname } from '@/lib/contour.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY = 8192;
const noStore = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
function fail(code: string, status: number) { return NextResponse.json({ code }, { status, headers: noStore }); }

async function handle(request: NextRequest, context: { params: Promise<{path:string[]}> }) {
  let config: ReturnType<typeof portalConfig>, features: ReturnType<typeof marketFeatures>, providers: ReturnType<typeof paymentProviders>;
  try { config = portalConfig(); features = marketFeatures(); providers = paymentProviders(marketName(), features); } catch { return fail('configuration_unavailable', 503); }
  // A request under the other contour's host never reaches this contour's Account API.
  if (contourHostProblem(contourName(), requestHostname(request.headers.get('host')))) return fail('configuration_unavailable', 503);
  const path = (await context.params).path.join('/');
  // Routes of a feature or payment provider this market does not serve (Ekza library,
  // Supporter, Solana or YooKassa, VK ID) are 404.
  const allowed = allowedPath(path, request.method, features, providers);
  if (!config.accountEnabled) return fail(
    (path === 'csrf' && request.method === 'GET') || allowed ? 'account_service_disabled' : 'not_found',
    (path === 'csrf' && request.method === 'GET') || allowed ? 503 : 404,
  );
  const jar = await cookies();
  const names = cookieNames(config.secure);
  const options = cookieOptions(config.secure);
  // Expiry keeps Secure: a browser ignores a `__Host-` deletion without it.
  const clear = (...list:string[]) => { for (const name of list) expireCookie(jar, name, config.secure); };
  if (path === 'csrf' && request.method === 'GET') {
    const token = jar.get(names.csrf)?.value || randomBytes(32).toString('hex');
    jar.set(names.csrf, token, {...options, maxAge:86400});
    return NextResponse.json({ token }, {headers:noStore});
  }
  if (!allowed) return fail('not_found',404);
  if (request.method !== 'GET' && !mutationAllowed(request.headers.get('origin'), config.origin,
    request.headers.get('x-csrf-token'), jar.get(names.csrf)?.value)) return fail('csrf_rejected',403);
  if (request.nextUrl.search.length > 2048) return fail('invalid_query',400);
  let body: Record<string,unknown> | undefined;
  let rawStrictBody: string | undefined;
  if (request.method === 'POST' || request.method === 'PATCH') {
    if (!request.headers.get('content-type')?.startsWith('application/json')) return fail('json_required',400);
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return fail('body_too_large',413);
    // Read a bounded stream even for chunked requests without Content-Length.
    const reader = request.body?.getReader(); let size=0; const chunks:Uint8Array[]=[];
    if (reader) {
      for (;;) { const {done,value}=await reader.read(); if(done) break; size+=value.length;
        if(size>MAX_BODY) { await reader.cancel(); return fail('body_too_large',413); } chunks.push(value); }
    }
    let raw: string;
    try { raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks)) || '{}'; body=JSON.parse(raw); }
    catch { return fail('invalid_json',400); }
    if (!body || Array.isArray(body) || typeof body !== 'object') return fail('invalid_json',400);
    // Preserve duplicate fields and numeric spellings for the authoritative
    // Rust parser; normalizing here would silently accept an invalid document.
    if (path === 'me/supporter/recognition' || path === CHECKOUT_PATH || /^me\/class-builds(?:\/[0-9a-f]{64})?$/.test(path)) rawStrictBody=raw;
  }
  const token = jar.get(names.session)?.value;
  // Ingress key (non-loopback API only) and the player's X-Real-IP from the portal's own ingress.
  const headers = accountUpstreamHeaders(request.headers.get('x-real-ip'));
  if (!headers) return fail('trusted_ingress_required',503);
  headers['Content-Type']='application/json';
  if (token) headers.Authorization='Bearer '+token;
  const operation = request.headers.get('idempotency-key');
  if (operation && /^[A-Za-z0-9_-]{16,128}$/.test(operation)) headers['Idempotency-Key']=operation;
  // A YooKassa payment: the Idempotency-Key is the BFF's, one per attempt, kept in an
  // HttpOnly cookie across retries of that attempt and saved before the call, so a lost
  // reply is retried with the same key (src/lib/checkout-attempt.mjs). The browser's
  // key is ignored; its quote goes through unchanged for the API to compare.
  let checkout: ReturnType<typeof checkoutAttempt> | null = null;
  if (path === CHECKOUT_PATH) {
    const attempt = checkoutRequest(body);
    if (!attempt) return fail('invalid_request',400);
    checkout = checkoutAttempt(parseCheckoutCookie(jar.get(names.checkout)?.value), checkoutFingerprint(token || '', attempt));
    jar.set(names.checkout, checkoutCookie(checkout), {...options, maxAge:CHECKOUT_COOKIE_SECONDS});
    headers['Idempotency-Key']=checkout.key;
  }
  // No browser-controlled actor, API URL, forwarding header or service token is forwarded.
  let target=path;
  if (path.startsWith('auth/pairings/') || path === 'auth/pairings') {
    if (body && Object.keys(body).length) return fail('invalid_json',400);
    const saved=jar.get(names.pair)?.value;
    const pieces=saved?.split('.');
    const pairing=pieces?.length===2 && pieces.every(p=>/^[0-9a-f]{64}$/.test(p))
      ? {pair_id:pieces[0],poll_secret:pieces[1]} : undefined;
    if (path === 'auth/pairings') {
      if (pairing) {
        try { await fetch(config.api+'/v1/auth/pairings/cancel', {method:'POST',headers,
          body:JSON.stringify(pairing),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)}); }
        catch { return fail('account_service_unavailable',503); }
      }
      body={};
    } else {
      if (!pairing) return fail('pairing_expired',401);
      body=pairing;
    }
  }
  if (path === 'auth/social/attach' || path === 'auth/social/ticket' || path === 'auth/social/enrollment') {
    // The VK ID ticket is injected from its HttpOnly cookie, never taken from the browser body.
    const social=socialTicketBody(path, body, jar.get(names.social)?.value);
    if ('code' in social) return fail(social.code, social.status);
    body=social.body;
  }
  try {
    const upstream=await fetch(config.api+'/v1/'+target+request.nextUrl.search, {
      method:request.method, headers, body:rawStrictBody ?? (body ? JSON.stringify(body):undefined),
      cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000),
    });
    const content=await upstream.text();
    if(content.length>2*1024*1024) return fail('invalid_service_response',502);
    let result:Record<string,unknown>;
    try { result=JSON.parse(content); } catch { return fail('invalid_service_response',502); }
    if (upstream.ok && path === 'auth/pairings') {
      const secret=result.poll_secret, id=result.pair_id;
      if(typeof secret!=='string'||typeof id!=='string'||![secret,id].every(v=>/^[a-f0-9]{64}$/.test(v))) return fail('invalid_service_response',502);
      jar.set(names.pair,id+'.'+secret,{...options,maxAge:360});
      result={code:result.code,expires_at:result.expires_at,interval:3};
    }
    if (upstream.ok && path === 'auth/pairings/complete') {
      if(typeof result.session_token!=='string'||!/^[a-f0-9]{64}$/.test(result.session_token)) return fail('invalid_service_response',502);
      jar.set(names.session,result.session_token,{...options,maxAge:7*86400});
      clear(names.pair, names.csrf);
      result={status:'connected'};
    }
    if(upstream.ok && path==='auth/pairings/cancel') clear(names.pair);
    if (checkout) {
      if (upstream.ok) {
        // Only YooKassa's HTTPS redirect reaches the browser; the attempt id stays here.
        const redirect=confirmationUrl(result.confirmation_url);
        if(!redirect) return fail('invalid_service_response',502);
        jar.set(names.checkout, checkoutCookie({...checkout, attempt:attemptId(result.attempt_id)}), {...options, maxAge:CHECKOUT_COOKIE_SECONDS});
        result={confirmation_url:redirect};
      } else if (checkoutFinished(upstream.status, result.code)) clear(names.checkout);
    }
    // The return page reads the payment list: once its attempt is over, the next payment gets a new key.
    if (upstream.ok && path===PAYMENTS_PATH && attemptFinished(result, parseCheckoutCookie(jar.get(names.checkout)?.value)?.attempt ?? null)) clear(names.checkout);
    if(upstream.status===404 && path==='auth/social/ticket') clear(names.social);
    if(path==='auth/logout' && (upstream.ok||upstream.status===401)) {
      clear(names.session, names.csrf, names.pair, names.social, names.vk, names.checkout);
      if(upstream.status===401)return NextResponse.json({status:'revoked'},{headers:noStore});
    }
    const response=NextResponse.json(result,{status:upstream.status,headers:noStore});
    const retry=upstream.headers.get('retry-after'); if(retry) response.headers.set('Retry-After',retry);
    return response;
  } catch { return fail('account_service_unavailable',503); }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
