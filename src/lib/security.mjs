import { timingSafeEqual } from 'node:crypto';
import { CONTOURS, CONTOUR_VARIABLE, contourName, foreignOrigin, isLoopbackHost } from './contour.mjs';

export function portalConfig(env = process.env) {
  const contour = contourName(env);
  const accountMode = env.OMOBA_ACCOUNT_MODE || 'enabled';
  if (!['enabled', 'disabled'].includes(accountMode)) throw new Error('Invalid account mode');
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
  contourPortal(contour, origin, api, env);
  return { origin: origin.origin, api: api.origin, secure: origin.protocol === 'https:', accountEnabled: accountMode === 'enabled' };
}

/**
 * The portal origin and the Account API belong to the active contour. production
 * keeps its rules and only refuses dev-contour hosts; dev serves from exactly
 * https://app.dev.omoba.io (loopback is an explicit local test) and has no hosted
 * Account API. A cross-contour value throws: the caller fails closed.
 * @param {'production'|'dev'} contour @param {URL} origin @param {URL} api
 * @param {Record<string, string | undefined>} env
 */
function contourPortal(contour, origin, api, env) {
  for (const [label, url] of [['Portal origin', origin], ['Account API', api]]) {
    const foreign = foreignOrigin(contour, url);
    if (foreign) throw new Error(label + ' ' + url.origin + ' ' + foreign);
  }
  if (contour !== 'dev') return;
  if (origin.origin !== CONTOURS.dev.portal && !(isLoopbackHost(origin.hostname) && env.OMOBA_ALLOW_INSECURE_LOCAL === '1'))
    throw new Error('Portal origin must be ' + CONTOURS.dev.portal + ' when ' + CONTOUR_VARIABLE + '=dev (loopback only with OMOBA_ALLOW_INSECURE_LOCAL=1)');
  // Any hosted Account API would be production's: the dev contour is guest-only.
  if (!isLoopbackHost(api.hostname))
    throw new Error('Account API must stay loopback when ' + CONTOUR_VARIABLE + '=dev (there is no hosted dev Account API)');
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length > 1024) return false;
  const aa=Buffer.from(a), bb=Buffer.from(b);
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}

export function allowedPath(path, method) {
  if (method === 'GET' && /^(me\/class-builds(?:\/[0-9a-f]{64})?|me\/ekza-library)$/.test(path)) return true;
  if (method === 'POST' && /^(me\/class-builds|me\/ekza-library\/(connect|poll))$/.test(path)) return true;
  if (method === 'PATCH' && /^me\/class-builds\/[0-9a-f]{64}$/.test(path)) return true;
  if (method === 'DELETE' && /^(me\/class-builds\/[0-9a-f]{64}|me\/ekza-library)$/.test(path)) return true;
  if (method === 'GET') return /^(supporters|me|me\/matches|me\/statistics|me\/friends|me\/sessions|me\/devices|me\/supporter|me\/supporter\/solana\/orders|players|players\/[0-9a-f]{64}|matches\/[A-Za-z0-9_-]{1,128}|releases)$/.test(path);
  if (method === 'PATCH') return /^(me\/profile|me\/settings|me\/supporter\/(aura|recognition))$/.test(path);
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

/**
 * Attributes of every portal cookie: host-only, HttpOnly, Lax, Secure on HTTPS.
 * @param {boolean} secure
 * @returns {{httpOnly: true, secure: boolean, sameSite: 'lax', path: '/'}}
 */
export function cookieOptions(secure) {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

/**
 * Expires a cookie with the attributes it was set with. A browser ignores a
 * `__Host-` Set-Cookie without Secure, so a bare `delete(name)` keeps the cookie
 * on an HTTPS portal.
 * @param {{set(name: string, value: string, options: object): unknown}} jar
 * @param {string} name
 * @param {boolean} secure
 */
export function expireCookie(jar, name, secure) {
  jar.set(name, '', { ...cookieOptions(secure), maxAge: 0, expires: new Date(0) });
}
