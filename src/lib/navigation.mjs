export const DEFAULT_SITE_URL = 'https://omoba.io';

const privateRoutes = new Set(['/me', '/me/matches', '/me/stats', '/workshop', '/friends', '/players', '/devices', '/supporter', '/settings', '/download', '/creators', '/market']);

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

/** A server-provided site origin allows a local round trip without exposing API settings. */
export function publicSiteUrl(raw, environment) {
  if (!raw) return DEFAULT_SITE_URL;
  try {
    if (/[\\\s\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_SITE_URL;
    const url = new URL(raw);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return DEFAULT_SITE_URL;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.protocol === 'https:' || (environment === 'development' && local && url.protocol === 'http:') ? url.origin : DEFAULT_SITE_URL;
  } catch { return DEFAULT_SITE_URL; }
}
