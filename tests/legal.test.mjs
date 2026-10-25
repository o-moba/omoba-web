// Legal documents and links (LR-04, LR-06): the market's legal table, footer and
// sign-in links, the versioned Russian drafts and what they must cover.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { MARKETS, MARKET_LEGAL, MARKET_PRESETS, marketLegal } from '../src/lib/market-profile.mjs';
import { LEGAL_DIR, LEGAL_PAGES, legalDocumentFile, legalLinks, legalPlainText, legalSourceUrl, parseInline, parseLegalDocument, signInNotice } from '../src/lib/legal.mjs';

// Written out by hand from the game's scripts/markets.py `Legal` (ru), independent of the module.
const RU_GAME_LEGAL = {
  version: '0-draft',
  privacy: 'https://omoba.ru/privacy',
  terms: 'https://omoba.ru/terms',
  source: 'https://github.com/o-moba/omoba-bevy/tree/v{version}-ru',
  supportEmail: null,
  communityVk: null,
  communityTelegram: null,
  ageRating: '12+',
};
const GAME_FIELDS = { version: 'version', privacy: 'privacy', terms: 'terms', source: 'source', supportEmail: 'support_email', communityVk: 'community_vk', communityTelegram: 'community_telegram', ageRating: 'age_rating' };
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const withoutOffer = ({ offer: _offer, ...rest }) => rest;

test('the RU legal table mirrors scripts/markets.py; global and cn have none', () => {
  assert.deepEqual(withoutOffer({ ...MARKET_LEGAL.ru }), RU_GAME_LEGAL);
  // Portal-only until the game table gains it (LR-67/LR-68).
  assert.equal(MARKET_LEGAL.ru.offer, 'https://omoba.ru/offer');
  assert.deepEqual(Object.keys(withoutOffer(MARKET_LEGAL.ru)).sort(), Object.keys(GAME_FIELDS).sort());
  for (const market of ['global', 'cn']) assert.ok(Object.values(MARKET_LEGAL[market]).every(value => value === null), market);
  assert.ok(Object.isFrozen(MARKET_LEGAL) && Object.values(MARKET_LEGAL).every(Object.isFrozen));
  for (const market of MARKETS) assert.equal(marketLegal(market), MARKET_LEGAL[market]);
  assert.ok(Object.values(marketLegal('eu')).every(value => value === null), 'an unknown market has no legal table');
  // The portal serves the documents at the paths the table (and so the game) links.
  for (const name of ['privacy', 'terms', 'offer']) assert.equal(new URL(MARKET_LEGAL.ru[name]).pathname, LEGAL_PAGES[name], name);
});

// Optional cross-check against the game's file: OMOBA_GAME_MARKETS_PY=<path to scripts/markets.py>.
test('the RU legal table equals the game\'s markets.py when it is available', { skip: !process.env.OMOBA_GAME_MARKETS_PY && 'set OMOBA_GAME_MARKETS_PY to compare' }, async () => {
  const source = await readFile(process.env.OMOBA_GAME_MARKETS_PY, 'utf8');
  const entries = Object.fromEntries([...source.matchAll(/^ {4}"(global|ru|cn)": Market\(([\s\S]*?)(?=^ {4}"(?:global|ru|cn)": Market\(|^\}$)/gm)].map(m => [m[1], m[2]]));
  assert.deepEqual(Object.keys(entries).sort(), ['cn', 'global', 'ru']);
  for (const market of ['global', 'cn']) assert.ok(!/legal=Legal\(/.test(entries[market]), market + ' has a legal table in markets.py');
  const block = /legal=Legal\(([\s\S]*?)\)\),?\s*$/m.exec(entries.ru)?.[1] ?? /legal=Legal\(([\s\S]*?)\)\)/.exec(entries.ru)?.[1];
  assert.ok(block, 'ru legal table not found');
  const game = Object.fromEntries([...block.matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  for (const [field, name] of Object.entries(GAME_FIELDS)) assert.equal(MARKET_LEGAL.ru[field], game[name] ?? null, field);
  assert.match(source, /portal="https:\/\/omoba\.ru"/);
});

test('footer links: privacy, terms and source in ru; nothing in global and cn', () => {
  const keys = (market, features = MARKET_PRESETS[market]) => legalLinks(marketLegal(market), features).map(link => link.key);
  assert.deepEqual(keys('global'), []);
  assert.deepEqual(keys('cn'), []);
  assert.deepEqual(keys('global', { supporter: true }), [], 'global stays unchanged even with Supporter');
  assert.deepEqual(legalLinks(marketLegal('ru'), MARKET_PRESETS.ru), [
    { key: 'privacy', href: '/privacy', external: false },
    { key: 'terms', href: '/terms', external: false },
    { key: 'source', href: 'https://github.com/o-moba/omoba-bevy', external: true },
  ]);
  // The offer follows the one Supporter switch (LR-67/LR-68).
  assert.deepEqual(keys('ru', { ...MARKET_PRESETS.ru, supporter: true }), ['privacy', 'terms', 'offer', 'source']);
  // Support and community appear once the owner provides them (LR-21).
  const channels = { ...MARKET_LEGAL.ru, supportEmail: 'support@omoba.ru', communityVk: 'https://vk.com/omoba', communityTelegram: 'https://t.me/omoba' };
  assert.deepEqual(legalLinks(channels, MARKET_PRESETS.ru).map(link => [link.key, link.href]), [
    ['privacy', '/privacy'], ['terms', '/terms'], ['support', 'mailto:support@omoba.ru'], ['source', 'https://github.com/o-moba/omoba-bevy'],
    ['vk', 'https://vk.com/omoba'], ['telegram', 'https://t.me/omoba'],
  ]);
});

test('source links: a release tag with a version, the repository without', () => {
  const ru = marketLegal('ru');
  assert.equal(legalSourceUrl(ru, '0.45.0'), 'https://github.com/o-moba/omoba-bevy/tree/v0.45.0-ru');
  assert.equal(legalSourceUrl(ru), 'https://github.com/o-moba/omoba-bevy');
  for (const bad of ['../main', '0.45.0 ', 'v/1', '']) assert.equal(legalSourceUrl(ru, bad), bad ? null : 'https://github.com/o-moba/omoba-bevy', JSON.stringify(bad));
  assert.equal(legalSourceUrl(marketLegal('global'), '0.45.0'), null);
});

test('the sign-in notice needs both documents', () => {
  assert.deepEqual(signInNotice(marketLegal('ru')), { terms: '/terms', privacy: '/privacy', version: '0-draft' });
  assert.equal(signInNotice(marketLegal('global')), null);
  assert.equal(signInNotice(marketLegal('cn')), null);
  assert.equal(signInNotice({ ...MARKET_LEGAL.ru, terms: null }), null);
});

test('document files follow the market and version; nothing else is read', () => {
  assert.equal(LEGAL_DIR, 'legal');
  assert.equal(legalDocumentFile('ru', marketLegal('ru'), 'privacy'), 'ru/0-draft/privacy.md');
  assert.equal(legalDocumentFile('ru', marketLegal('ru'), 'offer'), 'ru/0-draft/offer.md');
  for (const market of ['global', 'cn']) for (const name of ['privacy', 'terms', 'offer']) assert.equal(legalDocumentFile(market, marketLegal(market), name), null);
  assert.equal(legalDocumentFile('ru', marketLegal('ru'), 'cookies'), null);
  assert.equal(legalDocumentFile('ru', { ...MARKET_LEGAL.ru, version: null }, 'privacy'), null);
  for (const version of ['../../etc', '0/../x', 'A', '.hidden', 'a..b']) assert.throws(() => legalDocumentFile('ru', { ...MARKET_LEGAL.ru, version }, 'privacy'), /invalid/, version);
});

const DOC = (body, meta = 'title: Тест\nversion: 0-draft\nstatus: draft\neffective:') => '---\n' + meta + '\n---\n' + body;

test('the document format: front matter, headings, lists, notes, tables and inline marks', () => {
  const doc = parseLegalDocument(DOC([
    '## 1. Раздел {#one}', 'Абзац **жирный** и `код`,', 'вторая строка [ссылка](/privacy) и {{поле}}.', '',
    '1. первый', '2. второй', '- пункт', '3. третий', '', '> заметка', '', '| A | B |', '|---|---|', '| a1 | [x](mailto:a@b.ru) |', '',
    '### Подраздел', '- [сайт](https://omoba.ru)',
  ].join('\n')));
  assert.deepEqual(doc.meta, { title: 'Тест', version: '0-draft', status: 'draft', effective: null, review: null });
  assert.deepEqual(doc.blocks.map(block => block.type), ['h2', 'p', 'ol', 'ul', 'ol', 'note', 'table', 'h3', 'ul']);
  assert.equal(doc.blocks[0].id, 'one');
  assert.deepEqual(doc.blocks[1].inline, [
    { type: 'text', value: 'Абзац ' }, { type: 'strong', children: [{ type: 'text', value: 'жирный' }] }, { type: 'text', value: ' и ' },
    { type: 'code', value: 'код' }, { type: 'text', value: ', вторая строка ' }, { type: 'link', href: '/privacy', children: [{ type: 'text', value: 'ссылка' }] },
    { type: 'text', value: ' и ' }, { type: 'placeholder', value: 'поле' }, { type: 'text', value: '.' },
  ]);
  assert.equal(doc.blocks[2].start, 1);
  assert.equal(doc.blocks[2].items.length, 2);
  assert.equal(doc.blocks[4].start, 3, 'a numbered list split by bullets continues');
  assert.equal(doc.blocks[6].rows[0][1][0].href, 'mailto:a@b.ru');
  assert.match(legalPlainText(doc), /Абзац жирный и код, вторая строка ссылка и \{\{поле\}\}\./);
  const final = parseLegalDocument(DOC('Текст', 'title: T\nversion: 1\nstatus: final\neffective: 2026-12-01\nreview: юрист, 2026-11-20'));
  assert.deepEqual(final.meta, { title: 'T', version: '1', status: 'final', effective: '2026-12-01', review: 'юрист, 2026-11-20' });
});

test('the document format refuses unsafe links, unknown syntax and inconsistent metadata', () => {
  for (const href of ['javascript:alert(1)', 'http://omoba.ru', '//evil.example', 'data:text/html,x', 'https://', 'mailto:x', '/a b'])
    assert.throws(() => parseInline('[x](' + href + ')'), /not allowed|unbalanced/, href);
  for (const text of ['**открыто', '{{поле', 'поле}}', '**a [b](/x)**'])
    assert.throws(() => parseInline(text), /unbalanced|nested/, text);
  const bad = [
    DOC('# Заголовок'), DOC('#### Глубоко'), DOC('  отступ'), DOC('| a | b |\n| a |'), DOC('| a | b |\n|---|---|\n| 1 |'),
    'без front matter', '---\ntitle: T\n', DOC('x', 'title: T\nversion: 0-draft\nstatus: draft\neffective: 2026-01-01'),
    DOC('x', 'title: T\nversion: 1\nstatus: final\neffective:'), DOC('x', 'title: T\nversion: 1\nstatus: active\neffective:'),
    DOC('x', 'title: T\nversion: ../1\nstatus: draft\neffective:'), DOC('x', 'title: T\nversion: 1\nstatus: draft\neffective:\nauthor: x'),
    DOC('x', 'version: 1\nstatus: draft\neffective:'), DOC('x', 'title: T\ntitle: U\nversion: 1\nstatus: draft\neffective:'),
  ];
  for (const source of bad) assert.throws(() => parseLegalDocument(source), /legal:/, source);
});

async function documents() {
  const out = {};
  for (const market of MARKETS) {
    const legal = marketLegal(market);
    for (const name of Object.keys(LEGAL_PAGES)) {
      const file = legalDocumentFile(market, legal, name);
      if (file) out[market + '/' + name] = { file, legal, doc: parseLegalDocument(await read(LEGAL_DIR + '/' + file)) };
    }
  }
  return out;
}

test('every document of every market exists, parses and carries the version the game asks to accept', async () => {
  const docs = await documents();
  assert.deepEqual(Object.keys(docs).sort(), ['ru/offer', 'ru/privacy', 'ru/terms']);
  for (const [key, { legal, doc }] of Object.entries(docs)) {
    assert.equal(doc.meta.version, legal.version, key);
    // A draft version is a draft document with the visible banner and no effective date (section 7).
    if (legal.version.endsWith('-draft')) assert.deepEqual([doc.meta.status, doc.meta.effective], ['draft', null], key);
    assert.match(doc.meta.title, /[А-Яа-яЁё]/, key + ' is Russian');
    for (const block of doc.blocks) for (const link of JSON.stringify(block).matchAll(/"href":"(\/[^"]*)"/g))
      assert.ok([...Object.values(LEGAL_PAGES), '/supporter'].includes(link[1]), key + ' links ' + link[1]);
  }
  // Only versioned folders of known markets (and the format guide) live under legal/.
  assert.deepEqual((await readdir(new URL('legal/', root))).sort(), ['README.md', 'ru']);
});

/** Every category of data the RU services process → the words the privacy policy must contain. */
const PRIVACY_COVERAGE = {
  // career-store/migrations/postgres 001-004
  career_profiles: [/ник с тегом/, /рейтинг/, /опыт/],
  career_keys: [/открытый ключ устройства/, /название устройства/, /отозванный ключ/],
  'career_matches, career_participants, career_active_profiles': [/История матчей/, /участники/, /изменение рейтинга/],
  career_friendships: [/заявки в друзья/],
  career_presence: [/статус «в сети/],
  'career_profile_admissions, career_admission_salt': [/лимита создания новых профилей/, /48 часов/],
  // account-api/migrations 001-007
  web_pairings: [/коды подключения игры/],
  web_sessions: [/веб-сессии/, /7 дней/],
  profile_settings: [/публичность профиля/, /часовой пояс/],
  operation_receipts: [/подтверждения повторных запросов/, /8 дней/],
  rate_limits: [/HMAC-хеши IP-адресов/],
  audit_events: [/журнал событий безопасности/, /30 дней/],
  'projected_results, player_match_facts': [/статистика \(убийства, смерти, помощь/],
  'device_enrollments, recovery_codes': [/коды подключения игры и устройств/, /резервные коды восстановления/],
  'supporter_* (003, 006)': [/Добровольная поддержка проекта/, /публичной оферте/],
  // supporter_preferences (003, 006): the chosen aura is seen in matches; recognition_visible is opt-in.
  'supporter_preferences.aura (003)': [/выбранная аура/, /аура видна всем участникам матча/, /до её изменения игроком/],
  'supporter_preferences.recognition_visible (006)': [/публичное признание поддержки \(по умолчанию выключено\)/, /число месяцев поддержки/,
    /списке поддержавших/, /значком на карточке профиля/, /до его отключения игроком или удаления аккаунта/,
    /показывается публично в списке поддержавших и на карточке профиля, только если игрок сам это включил/],
  'supporter_* Apple/Solana (003), ekza_library_links (005)': [/только в международной версии/],
  class_builds: [/Сборки классов/],
  social_identities: [/HMAC-хеш идентификатора пользователя VK/, /способ входа/],
  'social_tickets, social_links': [/отображаемое имя VK/, /не более 30 минут/],
  // docs/bot-practice-and-social.md: chat in memory only
  'match chat and reactions': [/до 160 символов/, /32 последних событий/, /30 секунд/, /не записываются/],
  // LR-04 list
  'session and locale cookies': [/сессия \(7 дней\)/, /язык интерфейса \(1 год\)/],
  'feedback, crash and analytics (LR-20/29/30)': [/отзыв/, /отчёт о сбое/, /аналитика/],
  'log retention': [/системный журнал — 30 дней/, /журнал загрузок — 90 дней/],
  'backups': [/14 дней/, /8 недель/],
  operator: [/Оператор персональных данных/, /\{\{наименование оператора/, /\{\{адрес\}\}/, /\{\{e-mail для обращений\}\}/],
  'storage location and cross-border': [/на территории Российской Федерации/, /Трансграничная передача/],
  'data-subject requests and manual deletion (O-15, until LR-42)': [/Как направить запрос/, /10 рабочих дней/, /в срок не более 30 дней/, /Удалённый игрок/],
  'consent (LR-04)': [/Согласие на обработку персональных данных/],
};

test('the privacy policy covers every data category the RU services process', async () => {
  const text = legalPlainText((await documents())['ru/privacy'].doc);
  for (const [category, patterns] of Object.entries(PRIVACY_COVERAGE))
    for (const pattern of patterns) assert.match(text, pattern, category);
});

test('the user agreement covers conduct, chat, the sanctions ladder, liability and the open-source licences', async () => {
  const text = legalPlainText((await documents())['ru/terms'].doc);
  for (const pattern of [/Правила поведения/, /Чат и реакции/, /Нарушения и санкции/, /предупреждение/, /запрет отправлять сообщения в чат/,
    /запрет рейтинговых матчей/, /запрет подбора матчей/, /сброс ника/, /временная блокировка аккаунта/, /бессрочная блокировка аккаунта/,
    /оспорить санкцию/, /Ответственность/, /AGPL-3\.0-only/, /MPL-2\.0/, /CC-BY-4\.0/, /\{\{e-mail поддержки\}\}/])
    assert.match(text, pattern);
});

test('the offer covers the 30-day aura, prices, the payment service, refunds and the seller', async () => {
  const text = legalPlainText((await documents())['ru/offer'].doc);
  for (const pattern of [/на 30 дней/, /не даёт преимуществ/, /100, 250, 500, 1000, 2500, 5000 или 10 000 рублей/, /от 100 до 100 000 рублей/,
    /ЮKassa/, /54-ФЗ/, /Возврат/, /не продлевается автоматически/, /\{\{ИНН\}\}/, /\{\{ОГРНИП или ОГРН\}\}/, /\{\{адрес\}\}/, /\{\{телефон\}\}/, /\{\{e-mail продавца\}\}/])
    assert.match(text, pattern);
});

test('terms and privacy carry no payment-method or Ekza details (they live in the offer; LR-22/LR-68)', async () => {
  const docs = await documents();
  for (const name of ['ru/privacy', 'ru/terms']) {
    const text = legalPlainText(docs[name].doc);
    assert.doesNotMatch(text, /ЮKassa|ЮМани|банковск|Apple|Solana|Ekza|криптовалют|wallet|кошел/i, name);
    assert.doesNotMatch(JSON.stringify(docs[name].doc.blocks), /"href":"[^"]*(offer|supporter)/, name + ' links the offer or Supporter');
  }
});

test('legal code reads market values only through the accessors (LR-68)', async () => {
  for (const file of ['src/lib/legal.mjs', 'src/components/legal.tsx', 'src/components/legal-page.tsx'])
    // No market comparisons or hosts: values come from marketLegal / the market context.
    assert.doesNotMatch(await read(file), /market\s*[!=]==?|['"](global|cn)['"]|omoba\.ru|MARKET_LEGAL|marketName\(/, file);
});
