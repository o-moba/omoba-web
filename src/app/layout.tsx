import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";
import { getLocale } from '@/lib/locale-server';
import { LocaleProvider } from '@/components/locale-provider';
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = {
    en: { title: 'OMOBA · Player Portal', description: 'Find your play. Your OMOBA profile, match history and friends.' },
    ru: { title: 'OMOBA · Кабинет игрока', description: 'Твоя игра. Твой набор. Профиль OMOBA, история матчей и друзья.' },
    zh: { title: 'OMOBA · 玩家中心', description: '找到你的玩法。查看 OMOBA 个人资料、比赛记录和好友。' },
  };
  return { ...copy[locale], robots: { index: false, follow: false } };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : locale}>
      <body><LocaleProvider initialLocale={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
