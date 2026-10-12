import type { Metadata } from "next";
import { headers } from 'next/headers';
import "./globals.css";
import "./brand.css";
import { getLocale } from '@/lib/locale-server';
import { requestHostname } from '@/lib/contour.mjs';
import { assertContour, assertContourHost } from '@/lib/contour-guard.mjs';
import { LocaleProvider } from '@/components/locale-provider';
import { ContourProvider } from '@/components/contour';
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = {
    en: { title: 'OMOBA · Player Portal', description: 'Find your play. Your OMOBA profile, match history and friends.' },
    ru: { title: 'OMOBA · Кабинет игрока', description: 'Твоя игра. Твой набор. Профиль OMOBA, история матчей и друзья.' },
    zh: { title: 'OMOBA · 玩家中心', description: '找到你的玩法。查看 OMOBA 个人资料、比赛记录和好友。' },
  };
  // A dev tab is recognisable in the tab strip too, next to the header badge; the
  // template also prefixes the titles that pages set. Production is unchanged.
  const dev = assertContour() === 'dev';
  const title = dev ? { default: 'DEV · ' + copy[locale].title, template: 'DEV · %s' } : copy[locale].title;
  return { ...copy[locale], title, robots: { index: false, follow: false } };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A misconfigured contour, or a request that reached this contour under the
  // other contour's host, renders no page at all (fail closed).
  const contour = assertContour();
  assertContourHost(contour, requestHostname((await headers()).get('host')));
  const locale = await getLocale();
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : locale}>
      <head>
        <link rel="preload" href="/brand/fonts/BarlowCondensed-Bold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/brand/fonts/Inter-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/brand/fonts/Inter-SemiBold.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body><LocaleProvider initialLocale={locale} contour={contour}><ContourProvider contour={contour}>{children}</ContourProvider></LocaleProvider></body>
    </html>
  );
}
