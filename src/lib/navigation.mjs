import { CONTOURS, contourName } from './contour.mjs';

export const DEFAULT_SITE_URL = CONTOURS.production.site;

const privateRoutes = new Set(['/me', '/me/matches', '/me/stats', '/workshop', '/friends', '/players', '/devices', '/supporter', '/supporters', '/settings', '/download', '/creators', '/market', '/sponsor']);

/** Only known local pages may be used after game-confirmed browser sign-in. */
export function portalReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return '/me';
  try {
    const url = new URL(value, 'https://portal.invalid');
    if (url.origin !== 'https://portal.invalid' || url.hash) return '/me';
    if (!privateRoutes.has(url.pathname) && !/^\/matches\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname)) return '/me';
    return url.pathname + url.search;
  } catch { return '/me'; }
}

export function portalLoginHref(destination) {
  return '/login?returnTo=' + encodeURIComponent(portalReturnTo(destination));
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
 * production values under dev.
 */
export function contourSiteUrl(env = process.env) {
  return publicSiteUrl(env.OMOBA_SITE_URL, env.NODE_ENV, CONTOURS[contourName(env)].site);
}
