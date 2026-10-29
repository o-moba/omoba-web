import { CONTOURS, contourName } from './contour.mjs';
import { MARKET_LANDING, MARKET_PRESETS, marketLanding, marketName, navForMarket, routeEnabled } from './market-profile.mjs';

export const DEFAULT_SITE_URL = CONTOURS.production.site;

const privateRoutes = new Set(['/me', '/me/matches', '/me/stats', '/play', '/workshop', '/friends', '/players', '/devices', '/supporter', '/supporters', '/settings', '/download', '/creators', '/market', '/sponsor']);

/** The device-confirmation page the game opens: exactly one 8-character enrollment code. */
export const CONNECT_CODE = /^[A-Z2-9]{8}$/;

/** Sidebar order; `navForMarket` drops the pages this market does not serve. */
export const PORTAL_NAV = Object.freeze(['/me', '/me/matches', '/me/stats', '/players', '/friends', '/creators', '/market', '/sponsor', '/workshop', '/supporter', '/supporters', '/devices', '/settings']);
export const MOBILE_NAV = Object.freeze(['/me', '/me/matches', '/creators', '/workshop', '/supporters', '/friends']);
/** Buttons on the guest-prototype card. */
export const GUEST_LINKS = Object.freeze(['/creators', '/sponsor', '/market']);

/**
 * @param {readonly string[]} list
 * @param {{ekza: boolean, supporter: boolean}} [features] the market's features (default: global)
 */
export function portalNav(list, features = MARKET_PRESETS.global) {
  return navForMarket(list, features);
}

/**
 * The phone navigation: the market's pages, without the class workshop where the
 * market labels it experimental (`marketLanding`, LR-22); the sidebar keeps it, labelled.
 * @param {{ekza: boolean, supporter: boolean}} [features] the market's features (default: global)
 * @param {{workshop: "listed" | "experimental"}} [landing] the market's landing (default: global)
 */
export function mobileNav(features = MARKET_PRESETS.global, landing = MARKET_LANDING.global) {
  return portalNav(MOBILE_NAV, features).filter((href) => href !== '/workshop' || landing.workshop === 'listed');
}

/**
 * Only known local pages may be used after browser sign-in: game-confirmed
 * pairing or VK ID. Pages of a feature this market does not serve are refused,
 * and `/connect` keeps nothing but its enrollment code.
 * @param {unknown} value
 * @param {{ekza: boolean, supporter: boolean}} [features] the market's features (default: global)
 */
export function portalReturnTo(value, features = MARKET_PRESETS.global) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return '/me';
  try {
    const url = new URL(value, 'https://portal.invalid');
    if (url.origin !== 'https://portal.invalid' || url.hash) return '/me';
    if (url.pathname === '/connect') {
      const code = url.searchParams.get('code');
      return url.search === '?code=' + code && CONNECT_CODE.test(code || '') ? '/connect?code=' + code : '/me';
    }
    if (!privateRoutes.has(url.pathname) && !/^\/matches\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname)) return '/me';
    if (!routeEnabled(url.pathname, features)) return '/me';
    return url.pathname + url.search;
  } catch { return '/me'; }
}

/**
 * @param {unknown} destination
 * @param {{ekza: boolean, supporter: boolean}} [features]
 */
export function portalLoginHref(destination, features = MARKET_PRESETS.global) {
  return '/login?returnTo=' + encodeURIComponent(portalReturnTo(destination, features));
}

/**
 * A server-provided site origin allows a local round trip without exposing API
 * settings. A rejected value gives `fallback`, the active contour's site.
 */
export function publicSiteUrl(raw, environment, fallback = DEFAULT_SITE_URL) {
  if (!raw) return fallback;
  try {
    if (/[\\\s\u0000-\u001f\u007f]/.test(raw)) return fallback;
    const url = new URL(raw);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return fallback;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.protocol === 'https:' || (environment === 'development' && local && url.protocol === 'http:') ? url.origin : fallback;
  } catch { return fallback; }
}

/**
 * The OMOBA website of the active contour: `OMOBA_SITE_URL`, else
 * https://omoba.io (production) or https://dev.omoba.io (dev). Throws for an
 * unknown contour; the contour guard refuses dev values under production and
 * production values under dev. In a market whose landing is this portal's own guest
 * home (`marketLanding`, RU: LR-22) it is that page, `/`, and `OMOBA_SITE_URL` is
 * refused (`marketProblems`).
 */
export function contourSiteUrl(env = process.env) {
  if (marketLanding(marketName(env)).home === 'portal') return '/';
  return publicSiteUrl(env.OMOBA_SITE_URL, env.NODE_ENV, CONTOURS[contourName(env)].site);
}
