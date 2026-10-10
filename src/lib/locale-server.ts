import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, resolveLocale } from './locale.mjs';
import type { Locale } from './i18n';

export async function getLocale(): Promise<Locale> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: requestHeaders.get('accept-language'),
    country: requestHeaders.get('x-vercel-ip-country'),
  });
}
