import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { CONTOURS, CONTOUR_VARIABLE, DEV_ACCOUNT_API_ORIGIN, contourName, foreignOrigin, isLoopbackHost } from './contour.mjs';
import { marketFeatures } from './market-profile.mjs';

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
  accountRoute(origin, api, accountMode === 'enabled', env);
  return { origin: origin.origin, api: api.origin, secure: origin.protocol === 'https:', accountEnabled: accountMode === 'enabled' };
}

/**
 * How the portal reaches the Account API (docs/markets.md#hosting-the-ru-portal).
 * - Loopback (`http://127.0.0.1:40550` on the same host, the RU topology): no
 *   ingress key. A hosted portal must then forward the player's address
 *   (`OMOBA_TRUST_LOOPBACK_PROXY=1` here and on the API, behind an ingress that
 *   overwrites `X-Real-IP`); otherwise every player shares the portal's per-IP limits.
 * - Any other origin goes through an ingress that requires the portal ingress key,
 *   so enabled accounts need a 64-hex `OMOBA_ACCOUNT_INGRESS_KEY`.
 * A key that is set must be well formed; the trust switch is `1` or unset.
 * @param {URL} origin @param {URL} api @param {boolean} enabled
 * @param {Record<string, string | undefined>} env
 */
function accountRoute(origin, api, enabled, env) {
  const trust = env.OMOBA_TRUST_LOOPBACK_PROXY, key = env.OMOBA_ACCOUNT_INGRESS_KEY;
  if (trust !== undefined && trust !== '' && trust !== '0' && trust !== '1')
    throw new Error('OMOBA_TRUST_LOOPBACK_PROXY must be 1 or unset');
  if (key !== undefined && key !== '' && !OPAQUE_SECRET.test(key))
    throw new Error('OMOBA_ACCOUNT_INGRESS_KEY must be 64 lowercase hex characters');
  if (!enabled) return;
  if (!isLoopbackHost(api.hostname)) {
    if (!OPAQUE_SECRET.test(key || ''))
      throw new Error('Account API ' + api.origin + ' is reached through its ingress, which requires OMOBA_ACCOUNT_INGRESS_KEY (64 lowercase hex characters); on the API host call http://127.0.0.1:40550 instead');
    return;
  }
  if (!isLoopbackHost(origin.hostname) && env.OMOBA_ALLOW_INSECURE_LOCAL !== '1' && trust !== '1')
    throw new Error('Portal ' + origin.origin + ' calls the loopback Account API without OMOBA_TRUST_LOOPBACK_PROXY=1, so every player would share its address in per-IP limits; set it on the portal and the Account API behind an ingress that overwrites X-Real-IP');
}

/**
 * Startup check (src/instrumentation.ts): a bad Account API configuration stops
 * the server before the first request instead of failing every account call.
 * @param {Record<string, string | undefined>} [env]
 */
export function assertPortalConfig(env = process.env) {
  try {
    return portalConfig(env);
  } catch (error) {
    throw new Error('OMOBA portal misconfigured, refusing to serve (fail closed): ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * The portal origin and the Account API belong to the active contour. production
 * keeps its rules and only refuses dev-contour hosts; dev serves from exactly
 * https://app.dev.omoba.io and reaches only the exact dev Account API.
 * Loopback is reserved for disabled accounts or explicit local fixtures.
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
  const enabled = (env.OMOBA_ACCOUNT_MODE || 'enabled') === 'enabled';
  const localFixture = isLoopbackHost(api.hostname) && (!enabled || env.OMOBA_ALLOW_INSECURE_LOCAL === '1');
  if (api.origin !== DEV_ACCOUNT_API_ORIGIN && !localFixture)
    throw new Error('Account API must be ' + DEV_ACCOUNT_API_ORIGIN + ' when ' + CONTOUR_VARIABLE + '=dev (enabled loopback requires an explicit local fixture)');
  // The hosted dev API is reached through its ingress: accountRoute requires the key.
}

/** Server-only Account API ingress credential, sent to every Account API that is
 * not on loopback (`portalConfig` guarantees a valid key there). A loopback API
 * gets none. It never belongs in page props or cookies.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
export function accountIngressHeaders(env = process.env) {
  const config = portalConfig(env);
  if (!config.accountEnabled || isLoopbackHost(new URL(config.api).hostname)) return {};
  return { 'X-Omoba-Portal-Key': String(env.OMOBA_ACCOUNT_INGRESS_KEY) };
}

/**
 * Server-to-server headers of one Account API call: the ingress key (above) and,
 * with `OMOBA_TRUST_LOOPBACK_PROXY=1`, the player's address that the portal's own
 * ingress wrote into `X-Real-IP`, so per-IP limits stay per player. Null when that
 * address is required but missing or not an IP address (`trusted_ingress_required`).
 * @param {string | null | undefined} realIp the request's `X-Real-IP`
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string> | null}
 */
export function accountUpstreamHeaders(realIp, env = process.env) {
  const headers = { ...accountIngressHeaders(env) };
  if (env.OMOBA_TRUST_LOOPBACK_PROXY === '1') {
    if (typeof realIp !== 'string' || !isIP(realIp)) return null;
    headers['X-Real-IP'] = realIp;
  }
  return headers;
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length > 1024) return false;
  const aa=Buffer.from(a), bb=Buffer.from(b);
  return aa.length===bb.length && timingSafeEqual(aa,bb);
}

/**
 * The browser may reach only these Account API routes. Ekza library routes need
 * the `ekza` feature, Supporter routes `supporter`, VK ID routes `vkSignIn`; the
 * default is the running server's market (fail closed in ru/cn).
 * @param {string} path @param {string} method
 * @param {{ekza: boolean, supporter: boolean, vkSignIn: boolean}} [features]
 */
export function allowedPath(path, method, features = marketFeatures(process.env)) {
  if (/^me\/ekza-library(?:\/|$)/.test(path) && !features.ekza) return false;
  if ((/^me\/supporter(?:\/|$)/.test(path) || path === 'supporters') && !features.supporter) return false;
  if ((/^auth\/social(?:\/|$)/.test(path) || /^me\/social(?:\/|$)/.test(path)) && !features.vkSignIn) return false;
  if (method === 'POST' && /^auth\/social\/(?:attach|ticket)$/.test(path)) return true;
  if (method === 'DELETE' && path === 'me/social/vk') return true;
  if (method === 'GET' && /^(me\/class-builds(?:\/[0-9a-f]{64})?|me\/ekza-library)$/.test(path)) return true;
  if (method === 'POST' && /^(me\/class-builds|me\/ekza-library\/(connect|poll))$/.test(path)) return true;
  if (method === 'PATCH' && /^me\/class-builds\/[0-9a-f]{64}$/.test(path)) return true;
  if (method === 'DELETE' && /^(me\/class-builds\/[0-9a-f]{64}|me\/ekza-library)$/.test(path)) return true;
  if (method === 'GET') return /^(supporters|me|me\/matches|me\/statistics|me\/friends|me\/sessions|me\/devices|me\/supporter|me\/supporter\/solana\/orders|players|players\/[0-9a-f]{64}|matches\/[A-Za-z0-9_-]{1,128}|releases)$/.test(path);
  if (method === 'PATCH') return /^(me\/profile|me\/settings|me\/supporter\/(aura|recognition))$/.test(path);
  if (method === 'DELETE') return /^me\/(?:sessions|devices)\/[0-9a-f]{64}$/.test(path);
  return method === 'POST' && /^(me\/friend-actions|me\/devices\/(?:lookup|approve)|me\/recovery-codes|me\/supporter\/solana\/(?:checkout|confirm)|auth\/logout|auth\/pairings(?:\/(status|complete|cancel))?)$/.test(path);
}

/** An opaque Account API secret: 32 bytes as 64 lowercase hex characters. */
export const OPAQUE_SECRET = /^[a-f0-9]{64}$/;

/**
 * The Account API body of a VK ID ticket route. The ticket comes only from the
 * HttpOnly cookie: a browser body may carry nothing but the enrollment code for
 * `attach` and nothing at all for `ticket`, so it can never name a ticket.
 * @param {'auth/social/attach' | 'auth/social/ticket'} path
 * @param {Record<string, unknown> | undefined} body the parsed browser body
 * @param {string | undefined} ticket the social-ticket cookie
 * @returns {{body: Record<string, string>} | {code: string, status: number}}
 */
export function socialTicketBody(path, body, ticket) {
  const keys = Object.keys(body || {});
  if (path === 'auth/social/attach') {
    if (keys.length !== 1 || keys[0] !== 'code' || typeof body?.code !== 'string' || !/^[A-Z2-9]{8}$/.test(body.code))
      return { code: 'invalid_request', status: 400 };
  } else if (keys.length) return { code: 'invalid_request', status: 400 };
  if (!ticket || !OPAQUE_SECRET.test(ticket)) return { code: 'social_ticket_expired', status: 404 };
  return { body: path === 'auth/social/attach' ? { code: /** @type {string} */ (body?.code), social_ticket: ticket } : { social_ticket: ticket } };
}

export function mutationAllowed(origin, expected, token, cookie) {
  return origin === expected && /^[a-f0-9]{64}$/.test(token || '') && safeEqual(token, cookie);
}

export function cookieNames(secure) {
  const prefix = secure ? '__Host-' : '';
  // vk: the PKCE attempt of one VK ID sign-in; social: an unlinked VK ID ticket.
  return { session: prefix+'omoba-session', pair: prefix+'omoba-pair', csrf: prefix+'omoba-csrf', vk: prefix+'omoba-vk', social: prefix+'omoba-social' };
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
