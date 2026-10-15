import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { allowedPath, cookieNames, cookieOptions, expireCookie, mutationAllowed, portalConfig } from '@/lib/security.mjs';
import { contourHostProblem, contourName, requestHostname } from '@/lib/contour.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY = 8192;
const noStore = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
function fail(code: string, status: number) { return NextResponse.json({ code }, { status, headers: noStore }); }

async function handle(request: NextRequest, context: { params: Promise<{path:string[]}> }) {
  let config: ReturnType<typeof portalConfig>;
  try { config = portalConfig(); } catch { return fail('configuration_unavailable', 503); }
  // A request under the other contour's host never reaches this contour's Account API.
  if (contourHostProblem(contourName(), requestHostname(request.headers.get('host')))) return fail('configuration_unavailable', 503);
  const path = (await context.params).path.join('/');
  if (!config.accountEnabled) return fail(
    (path === 'csrf' && request.method === 'GET') || allowedPath(path, request.method) ? 'account_service_disabled' : 'not_found',
    (path === 'csrf' && request.method === 'GET') || allowedPath(path, request.method) ? 503 : 404,
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
  if (!allowedPath(path, request.method)) return fail('not_found',404);
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
    if (path === 'me/supporter/recognition' || /^me\/class-builds(?:\/[0-9a-f]{64})?$/.test(path)) rawStrictBody=raw;
  }
  const token = jar.get(names.session)?.value;
  const headers: Record<string,string> = {'Content-Type':'application/json'};
  if (token) headers.Authorization='Bearer '+token;
  if(process.env.OMOBA_TRUST_LOOPBACK_PROXY==='1'){
    const ip=request.headers.get('x-real-ip');if(!ip||!isIP(ip))return fail('trusted_ingress_required',503);headers['X-Real-IP']=ip;
  }
  const operation = request.headers.get('idempotency-key');
  if (operation && /^[A-Za-z0-9_-]{16,128}$/.test(operation)) headers['Idempotency-Key']=operation;
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
          body:JSON.stringify(pairing),cache:'no-store',signal:AbortSignal.timeout(5000)}); }
        catch { return fail('account_service_unavailable',503); }
      }
      body={};
    } else {
      if (!pairing) return fail('pairing_expired',401);
      body=pairing;
    }
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
    if(path==='auth/logout' && (upstream.ok||upstream.status===401)) {
      clear(names.session, names.csrf, names.pair);
      if(upstream.status===401)return NextResponse.json({status:'revoked'},{headers:noStore});
    }
    const response=NextResponse.json(result,{status:upstream.status,headers:noStore});
    const retry=upstream.headers.get('retry-after'); if(retry) response.headers.set('Retry-After',retry);
    return response;
  } catch { return fail('account_service_unavailable',503); }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
