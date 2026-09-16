import { timingSafeEqual } from 'node:crypto';

export function portalConfig(env = process.env) {
  const origin = new URL(env.OMOBA_PORTAL_ORIGIN || 'http://127.0.0.1:3010');
  const api = new URL(env.OMOBA_ACCOUNT_API_URL || 'http://127.0.0.1:40550');
  const local = u => ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  for (const u of [origin, api]) {
    if (u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('Invalid portal origin configuration');
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local(u))) throw new Error('HTTPS required');
  }
  if (origin.protocol !== 'https:' && env.NODE_ENV === 'production' && env.OMOBA_ALLOW_INSECURE_LOCAL !== '1') {
    throw new Error('Production portal requires HTTPS; explicit local test override only');
  }
  return { origin: origin.origin, api: api.origin, secure: origin.protocol === 'https:' };
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length > 1024) return false;
  const aa=Buffer.from(a), bb=Buffer.from(b);
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}

export function allowedPath(path, method) {
  if (method === 'GET') return /^(me|me\/matches|me\/statistics|me\/friends|me\/sessions|me\/devices|me\/supporter|me\/supporter\/solana\/orders|players|players\/[0-9a-f]{64}|matches\/[A-Za-z0-9_-]{1,128}|releases)$/.test(path);
  if (method === 'PATCH') return /^(me\/profile|me\/settings|me\/supporter\/aura)$/.test(path);
  if (method === 'DELETE') return /^me\/(?:sessions|devices)\/[0-9a-f]{64}$/.test(path);
  return method === 'POST' && /^(me\/friend-actions|me\/devices\/(?:lookup|approve)|me\/recovery-codes|me\/supporter\/solana\/(?:checkout|confirm)|auth\/logout|auth\/pairings(?:\/(status|complete|cancel))?)$/.test(path);
}

export function mutationAllowed(origin, expected, token, cookie) {
  return origin === expected && /^[a-f0-9]{64}$/.test(token || '') && safeEqual(token, cookie);
}

export function cookieNames(secure) {
  const prefix = secure ? '__Host-' : '';
  return { session: prefix+'omoba-session', pair: prefix+'omoba-pair', csrf: prefix+'omoba-csrf' };
}
