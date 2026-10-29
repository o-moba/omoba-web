import 'server-only';
import { cookies, headers } from 'next/headers';
import { requestHostname, resolveLocale, storedLocale } from './locale.mjs';
import { contourName } from './contour.mjs';
import { marketName } from './market-profile.mjs';
import type { Locale } from './i18n';

export async function getLocale(): Promise<Locale> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    // The dev contour has its own preference cookie; see localeCookieName.
    cookie: storedLocale(name => cookieStore.get(name)?.value, requestHostname(requestHeaders.get('host')), contourName()),
    acceptLanguage: requestHeaders.get('accept-language'),
    country: requestHeaders.get('x-vercel-ip-country'),
    // ru and cn fall back to their own language, never to the IP country.
    market: marketName(),
  });
}
