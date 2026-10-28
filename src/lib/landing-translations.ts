import type { Locale } from './i18n';

/**
 * The guest home (a market's landing on this portal, LR-22), the download cards and the
 * experimental workshop label. Mode, map and button names are the game's own
 * (omoba-bevy client/i18n: queue.json, home.json, career.json, devices.json), so the page
 * and the game name them alike. No store, wallet or payment text belongs here.
 */
export const landingTranslations: Record<string, { ru: string; zh: string }> = {
  'FREE · OPEN SOURCE · 5V5': { ru: 'БЕСПЛАТНО · ОТКРЫТЫЙ КОД · 5 НА 5', zh: '免费 · 开源 · 5V5' },
  'Five against five on the Verdant Arena.': { ru: 'Пять на пять на Изумрудной арене.', zh: '翠绿竞技场上的五对五对决。' },
  'Ranked and casual matches with other players, games against bots and offline practice.': {
    ru: 'Рейтинговые и обычные матчи с другими игроками, игры против ботов и офлайн-тренировка.',
    zh: '与其他玩家进行排位赛和匹配对战，也可以挑战人机或离线练习。',
  },
  'Download the game': { ru: 'Скачать игру', zh: '下载游戏' },
  'Age rating': { ru: 'Возрастная категория', zh: '年龄分级' },
  'Release status': { ru: 'Статус выпуска', zh: '版本状态' },
  'Modes': { ru: 'Режимы', zh: '模式' },
  'Ranked': { ru: 'Рейтинговый', zh: '排位赛' },
  'Ten players, rated, never filled with bots.': { ru: 'Десять игроков, матч с рейтингом, без ботов.', zh: '十名玩家，计入排位分，不补充人机。' },
  'Casual PvP': { ru: 'Обычный PvP', zh: '匹配对战' },
  'Everyone searching plays together; bots fill the empty seats. Unrated, earns experience.': {
    ru: 'Все, кто в поиске, играют вместе; свободные места занимают боты. Без рейтинга, опыт начисляется.',
    zh: '所有排队玩家一起对战，空位由人机补足。不计排位分，可获得经验。',
  },
  'vs Bots': { ru: 'Против ботов', zh: '人机对战' },
  'You or your party against server bots.': { ru: 'Вы или ваша группа против ботов на сервере.', zh: '你或你的队伍对战服务器人机。' },
  'Offline practice': { ru: 'Офлайн-тренировка', zh: '离线练习' },
  'Every class on your device, without a server or an account.': { ru: 'Все классы на вашем устройстве — без сервера и аккаунта.', zh: '在你的设备上使用全部职业，无需服务器或账号。' },
  'Download': { ru: 'Скачать', zh: '下载' },
  'Download for {platform}': { ru: 'Скачать для {platform}', zh: '下载 {platform} 版' },
  'Check the file you downloaded: its SHA-256 must match the one shown here.': {
    ru: 'Проверьте скачанный файл: его SHA-256 должен совпадать с указанным здесь.',
    zh: '请校验下载的文件：其 SHA-256 应与此处显示的一致。',
  },
  'The download list is unavailable right now. Try again later.': {
    ru: 'Список загрузок сейчас недоступен. Попробуйте позже.',
    zh: '下载列表暂时不可用，请稍后再试。',
  },
  'All downloads': { ru: 'Все загрузки', zh: '全部下载' },
  'Your progress': { ru: 'Ваш прогресс', zh: '你的进度' },
  'Sign in here with VK, OK or Mail.ru to create your profile, then use the same account in the game: Profile → Sign in with VK ID. Already playing? Link your existing profile from the game first to keep your progress.': {
    ru: 'Войдите здесь через VK, OK или Mail.ru, чтобы создать профиль. Затем войдите с тем же аккаунтом в игре: «Профиль» → «Войти через VK ID». Уже играете? Сначала привяжите существующий профиль в игре, чтобы сохранить прогресс.',
    zh: '在这里使用 VK、OK 或 Mail.ru 登录以创建资料，然后在游戏中使用同一账号：“资料” → “使用 VK ID 登录”。已经玩过？请先在游戏中关联现有资料以保留进度。',
  },
  'The game creates your profile when you first start it. To see your matches here and to play on other devices, sign in with VK ID in the game: Profile → Sign in with VK ID.': {
    ru: 'Игра создаёт ваш профиль при первом запуске. Чтобы видеть здесь свои матчи и играть на других устройствах, войдите через VK ID в игре: «Профиль» → «Войти через VK ID».',
    zh: '游戏首次启动时会创建你的资料。若要在这里查看比赛并在其他设备上游戏，请在游戏中使用 VK ID 登录：“资料” → “使用 VK ID 登录”。',
  },
  'The game creates your profile when you first start it. To see your matches here, connect the game to this site: Profile → Link or recover account.': {
    ru: 'Игра создаёт ваш профиль при первом запуске. Чтобы видеть здесь свои матчи, подключите игру к сайту: «Профиль» → «Привязать или восстановить аккаунт».',
    zh: '游戏首次启动时会创建你的资料。若要在这里查看比赛，请将游戏连接到本网站：“资料” → “关联或恢复账号”。',
  },
  'experimental': { ru: 'эксперимент', zh: '实验性' },
  'Experimental: the class workshop is a prototype. Class builds are drafts and cannot be used in online matches.': {
    ru: 'Эксперимент: мастерская классов — прототип. Сборки классов — черновики, их нельзя использовать в сетевых матчах.',
    zh: '实验性功能：职业工坊仍是原型。职业构筑只是草稿，不能在联网比赛中使用。',
  },
  'OMOBA · Free 5v5 MOBA': { ru: 'OMOBA · Бесплатная MOBA 5 на 5', zh: 'OMOBA · 免费 5v5 MOBA' },
};

/** The hero class claim with the right plural form: `17 классов героев`, `21 класс героев`. */
export function classesClaim(locale: Locale, classes: number): string {
  const count = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale).format(classes);
  if (locale === 'zh') return count + ' 个英雄职业。';
  const form = new Intl.PluralRules(locale).select(classes);
  if (locale === 'ru') return count + ' ' + (form === 'one' ? 'класс' : form === 'few' ? 'класса' : 'классов') + ' героев.';
  return count + (form === 'one' ? ' hero class.' : ' hero classes.');
}

/** Server-side text (metadata) in the page language. */
export function landingText(locale: Locale, source: string): string {
  return locale === 'en' ? source : landingTranslations[source]?.[locale] ?? source;
}

/** The guest home's title and description for search engines and link previews. */
export function landingMetadata(locale: Locale, classes: number) {
  return {
    title: landingText(locale, 'OMOBA · Free 5v5 MOBA'),
    description: classesClaim(locale, classes) + ' ' + landingText(locale, 'Ranked and casual matches with other players, games against bots and offline practice.'),
  };
}
