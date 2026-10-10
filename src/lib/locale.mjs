export const LOCALE_COOKIE = 'omoba_locale';
export const SUPPORTED_LOCALES = ['en', 'ru', 'zh'];

/** @param {unknown} value @returns {'en'|'ru'|'zh'|null} */
export function normalizeLocale(value) {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return language === 'en' || language === 'ru' || language === 'zh' ? language : null;
}

/** Manual choice wins; browser language takes priority over a country fallback.
 * @param {{cookie?:string|null,acceptLanguage?:string|null,country?:string|null}} options
 * @returns {'en'|'ru'|'zh'}
 */
export function resolveLocale({ cookie, acceptLanguage, country } = {}) {
  if (SUPPORTED_LOCALES.includes(cookie || '')) return /** @type {'en'|'ru'|'zh'} */ (cookie);
  const preferences = (acceptLanguage || '').split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    const weight = quality ? Number(quality.trim().slice(2)) : 1;
    return { locale: normalizeLocale(tag), weight, index };
  }).filter(item => item.locale && Number.isFinite(item.weight) && item.weight > 0 && item.weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  if (preferences[0]?.locale) return preferences[0].locale;
  if (['CN', 'TW', 'HK', 'MO'].includes((country || '').toUpperCase())) return 'zh';
  if ((country || '').toUpperCase() === 'RU') return 'ru';
  return 'en';
}

/** @param {'en'|'ru'|'zh'} locale @param {string} hostname @param {string} protocol */
export function localeCookie(locale, hostname, protocol = 'https:') {
  const domain = hostname === 'omoba.io' || hostname.endsWith('.omoba.io') ? '; Domain=.omoba.io' : '';
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${protocol === 'https:' ? '; Secure' : ''}`;
}
