import { isDevContourHost } from './contour.mjs';

// The request host helper lives with the contour rules; kept here for callers.
export { requestHostname } from './contour.mjs';

export const LOCALE_COOKIE = 'omoba_locale';
/** The dev contour keeps its own host-only preference (see localeCookieName). */
export const DEV_LOCALE_COOKIE = 'omoba_locale_dev';
export const SUPPORTED_LOCALES = ['en', 'ru', 'zh'];

/** @param {unknown} value @returns {'en'|'ru'|'zh'|null} */
export function normalizeLocale(value) {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return language === 'en' || language === 'ru' || language === 'zh' ? language : null;
}

/** Manual choice wins; browser language takes priority over a country fallback.
 * The `ru` and `cn` markets have their own fallback (`ru`, `zh`) instead of the
 * IP-country heuristic; the global market keeps it.
 * @param {{cookie?:string|null,acceptLanguage?:string|null,country?:string|null,market?:'global'|'ru'|'cn'}} options
 * @returns {'en'|'ru'|'zh'}
 */
export function resolveLocale({ cookie, acceptLanguage, country, market = 'global' } = {}) {
  if (SUPPORTED_LOCALES.includes(cookie || '')) return /** @type {'en'|'ru'|'zh'} */ (cookie);
  const preferences = (acceptLanguage || '').split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    const weight = quality ? Number(quality.trim().slice(2)) : 1;
    return { locale: normalizeLocale(tag), weight, index };
  }).filter(item => item.locale && Number.isFinite(item.weight) && item.weight > 0 && item.weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  if (preferences[0]?.locale) return preferences[0].locale;
  if (market === 'ru') return 'ru';
  if (market === 'cn') return 'zh';
  if (['CN', 'TW', 'HK', 'MO'].includes((country || '').toUpperCase())) return 'zh';
  if ((country || '').toUpperCase() === 'RU') return 'ru';
  return 'en';
}

/**
 * A dev deployment, or any dev-contour host (`dev.omoba.io`, `*.dev.omoba.io`),
 * never touches the production language preference. Either is enough.
 * @param {string} hostname @param {'production'|'dev'} [contour]
 */
export function isDevLocaleScope(hostname, contour = 'production') {
  return contour === 'dev' || isDevContourHost(hostname);
}

/**
 * Production hosts share one `omoba_locale` across `.omoba.io`. The dev contour
 * writes its own host-only cookie under another name: it can neither change
 * production's preference nor be shadowed by it (both reach a dev host, because
 * production's cookie has `Domain=.omoba.io`).
 * @param {string} hostname @param {'production'|'dev'} [contour]
 */
export function localeCookieName(hostname, contour = 'production') {
  return isDevLocaleScope(hostname, contour) ? DEV_LOCALE_COOKIE : LOCALE_COOKIE;
}

/**
 * @param {'en'|'ru'|'zh'} locale @param {string} hostname @param {string} protocol
 * @param {'production'|'dev'} [contour]
 */
export function localeCookie(locale, hostname, protocol = 'https:', contour = 'production') {
  const shared = !isDevLocaleScope(hostname, contour) && (hostname === 'omoba.io' || hostname.endsWith('.omoba.io'));
  const domain = shared ? '; Domain=.omoba.io' : '';
  return `${localeCookieName(hostname, contour)}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${protocol === 'https:' ? '; Secure' : ''}`;
}

/**
 * The stored manual choice for a request: in the dev contour its own cookie,
 * then production's shared preference (read only) as a starting point.
 * @param {(name: string) => string | undefined} read @param {string | null | undefined} hostname
 * @param {'production'|'dev'} [contour]
 */
export function storedLocale(read, hostname, contour = 'production') {
  const name = localeCookieName(hostname || '', contour);
  const own = read(name);
  if (own || name === LOCALE_COOKIE) return own;
  return read(LOCALE_COOKIE);
}
