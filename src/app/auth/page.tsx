import { notFound } from 'next/navigation';
import { contourName, CONTOURS } from '@/lib/contour.mjs';
import { getLocale } from '@/lib/locale-server';
import { marketName } from '@/lib/market-profile.mjs';

const copy = {
  ru: { title: 'Вернитесь в OMOBA', body: 'Эта ссылка открывает игру на iPhone или iPad. Если вы остались в браузере, откройте OMOBA вручную. Для автоматического возврата нужна новая сборка с поддержкой универсальных ссылок.', status: 'Подтвердите вход в самой игре. Открытие этой страницы не выполняет вход и не меняет аккаунт.', home: 'На сайт OMOBA', download: 'Скачать игру' },
  en: { title: 'Return to OMOBA', body: 'This link opens the game on iPhone or iPad. If you stayed in the browser, open OMOBA manually. Automatic return requires a new build with Universal Links support.', status: 'Confirm sign-in in the game. Opening this page does not sign you in or change your account.', home: 'OMOBA website', download: 'Download the game' },
  zh: { title: '返回 OMOBA', body: '此链接会在 iPhone 或 iPad 上打开游戏。如果仍停留在浏览器中，请手动打开 OMOBA。自动返回需要支持通用链接的新版本。', status: '请在游戏中确认登录。打开此页面不会登录或更改账号。', home: 'OMOBA 网站', download: '下载游戏' },
};

export default async function IosReturnPage() {
  if (marketName() !== 'ru') notFound();
  const text = copy[await getLocale()];
  const portal = contourName() === 'dev' ? CONTOURS.dev.portal : 'https://omoba.ru';
  return <main className="card login-card" data-ios-return>
    <h1>{text.title}</h1><p>{text.body}</p><p className="muted">{text.status}</p>
    <p><a className="button" href={portal}>{text.home}</a></p>
    <p><a href={portal + '/download'}>{text.download}</a></p>
  </main>;
}
