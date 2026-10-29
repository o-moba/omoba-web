// The RU landing on the portal (LR-22): the market's landing table, the site link,
// the experimental workshop, the download catalog as a page shows it, the counted
// claims, and no donate, wallet, crypto or Ekza text on the guest home.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { MARKET_LANDING, MARKETS, assertMarket, marketLanding, marketLocale, marketProblems } from '../src/lib/market-profile.mjs';
import { contourSiteUrl, mobileNav, MOBILE_NAV } from '../src/lib/navigation.mjs';
import { MARKET_PRESETS } from '../src/lib/market-profile.mjs';
import { RELEASE_PLATFORMS, RELEASE_STATUS_LABELS, directRelease, pageReleases, releasePlatform, releaseSize, releaseStatus } from '../src/lib/releases.mjs';
import { parseAssetCatalog } from '../src/lib/asset-catalog.mjs';

async function importTs(path) {
  const source = stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'));
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

/** Text that must never reach an RU surface: donations, wallets, crypto, Solana, Ekza. */
const FORBIDDEN = /\/donate|donat|донат|wallet|кошел[её]к|crypto(?!graph)|криптовалют|solana|ekza/i;

test('the RU landing is the portal guest home; global and cn keep the website', () => {
  assert.deepEqual(Object.keys(MARKET_LANDING).sort(), [...MARKETS].sort());
  assert.deepEqual(marketLanding('ru'), { home: 'portal', workshop: 'experimental' });
  for (const market of ['global', 'cn']) assert.deepEqual(marketLanding(market), { home: 'site', workshop: 'listed' });
  // An unknown market has no landing of its own (fail closed: the website).
  assert.equal(marketLanding('xx').home, 'site');
  assert.equal(marketLocale('ru'), 'ru');
});

test('the RU site link is its own home page and OMOBA_SITE_URL is refused there', () => {
  assert.equal(contourSiteUrl({ OMOBA_MARKET: 'ru' }), '/');
  assert.equal(contourSiteUrl({ OMOBA_MARKET: 'ru', OMOBA_CONTOUR: 'dev' }), '/');
  assert.equal(contourSiteUrl({}), 'https://omoba.io');
  assert.equal(contourSiteUrl({ OMOBA_SITE_URL: 'https://players.example' }), 'https://players.example');
  assert.match(marketProblems({ OMOBA_MARKET: 'ru', OMOBA_SITE_URL: 'https://omoba.io' }).join('\n'),
    /OMOBA_SITE_URL must be unset in the ru market: its landing is this portal's own home page/);
  assert.throws(() => assertMarket({ OMOBA_MARKET: 'ru', OMOBA_SITE_URL: 'https://omoba.ru' }), /OMOBA_SITE_URL must be unset/);
  assert.deepEqual(marketProblems({ OMOBA_MARKET: 'ru' }), []);
  assert.deepEqual(marketProblems({ OMOBA_SITE_URL: 'https://omoba.io' }), []);
});

test('the RU workshop is labelled experimental and left out of the phone navigation', () => {
  assert.ok(MOBILE_NAV.includes('/workshop'));
  assert.ok(!mobileNav(MARKET_PRESETS.ru, marketLanding('ru')).includes('/workshop'));
  assert.deepEqual(mobileNav(MARKET_PRESETS.ru, marketLanding('ru')), ['/me', '/me/matches', '/friends']);
  assert.ok(mobileNav(MARKET_PRESETS.global, marketLanding('global')).includes('/workshop'));
  assert.deepEqual(mobileNav(), mobileNav(MARKET_PRESETS.global, marketLanding('global')));
});

const RELEASE = {
  platform: 'linux', architecture: 'x86_64', version: '0.45.0', url: 'https://omoba.ru/downloads/v0.45.0/omoba-0.45.0-ru-linux-x64.tar.gz',
  sha256: 'a'.repeat(64), size_bytes: '327577600', published_at: '2026-10-24T00:00:00Z', instructions: 'Распакуйте архив и запустите ./omoba.',
  test_status: 'Открытая бета', region: 'ru', channel: 'direct', update_url: 'https://omoba.ru/download?platform=linux',
  mirror_url: 'https://gateway.example/ipfs/bafy/omoba-0.45.0-ru-linux-x64.tar.gz',
};

test('a page offers direct downloads only, newest per platform, in platform order', () => {
  const shown = directRelease(RELEASE);
  assert.deepEqual(Object.keys(shown).sort(), ['architecture', 'instructions', 'platform', 'published_at', 'sha256', 'size_bytes', 'test_status', 'url', 'version']);
  // The IPFS mirror is never offered on a page.
  assert.ok(!JSON.stringify(shown).includes('ipfs'));
  for (const bad of [
    { channel: 'app_store' }, { channel: 'google_play' }, { platform: 'ios' }, { platform: 'plan9' },
    { url: 'http://omoba.ru/x.tar.gz' }, { url: 'https://user:pw@omoba.ru/x' }, { url: 'not a url' },
    { sha256: 'A'.repeat(64) }, { sha256: 'a'.repeat(63) }, { size_bytes: '0' }, { size_bytes: '12MB' }, { size_bytes: 12 },
    { version: '' }, { test_status: 'x\n' }, { architecture: undefined },
  ]) assert.equal(directRelease({ ...RELEASE, ...bad }), null, JSON.stringify(bad));
  assert.equal(directRelease({ ...RELEASE, channel: undefined }).platform, 'linux');
  assert.equal(directRelease(null), null);
  const older = { ...RELEASE, version: '0.44.0', published_at: '2026-10-01T00:00:00Z' };
  const catalog = { releases: [
    { ...RELEASE, platform: 'android', architecture: 'universal' }, older, RELEASE,
    { ...RELEASE, platform: 'windows' }, { ...RELEASE, platform: 'macos', architecture: 'arm64' },
    { ...RELEASE, platform: 'ios', architecture: 'arm64' }, { ...RELEASE, channel: 'rustore', platform: 'android', architecture: 'universal' },
  ] };
  assert.deepEqual(pageReleases(catalog).map((r) => r.platform + '/' + r.version), ['windows/0.45.0', 'macos/0.45.0', 'linux/0.45.0', 'android/0.45.0']);
  for (const empty of [null, {}, { releases: 'x' }, { releases: [] }, []]) assert.deepEqual(pageReleases(empty), []);
  assert.deepEqual(Object.keys(RELEASE_PLATFORMS), ['windows', 'macos', 'linux', 'android']);
  assert.equal(releasePlatform('macos'), 'macOS');
});

test('sizes show in megabytes and the status in the page language', () => {
  assert.equal(releaseSize('327577600', 'ru'), '312,4 МБ');
  assert.equal(releaseSize('327577600', 'en'), '312.4 MB');
  assert.equal(releaseSize(1048576, 'zh'), '1.0 MB');
  // The RU catalog's label (scripts/markets.py release_label) and the global one.
  assert.equal(releaseStatus('Открытая бета', 'ru'), 'Открытая бета');
  assert.equal(releaseStatus('Открытая бета', 'en'), 'Open beta');
  assert.equal(releaseStatus('Открытая бета', 'zh'), '公开测试');
  assert.equal(releaseStatus('playtest', 'ru'), 'Тестовая сборка');
  assert.equal(releaseStatus('Closed alpha', 'ru'), 'Closed alpha');
  for (const labels of Object.values(RELEASE_STATUS_LABELS)) assert.deepEqual(Object.keys(labels).sort(), ['en', 'ru', 'zh']);
});

test('the class claim is counted from the game catalog snapshot, with Russian plurals', async () => {
  const { classesClaim } = await importTs('../src/lib/landing-translations.ts');
  const catalog = parseAssetCatalog(await readFile(new URL('../public/asset-catalog/catalog.json', import.meta.url), 'utf8'));
  const classes = catalog.classes.length;
  assert.ok(classes >= 16, 'the snapshot lost its classes');
  // Optional cross-check against the game: OMOBA_GAME_HEROES=<omoba-bevy>/shared/assets/catalog/heroes.json.
  if (process.env.OMOBA_GAME_HEROES) {
    const heroes = JSON.parse(await readFile(process.env.OMOBA_GAME_HEROES, 'utf8'));
    assert.equal(classes, heroes.classes.length, 'the portal snapshot and the game catalog count different classes');
  }
  assert.equal(classesClaim('ru', 17), '17 классов героев.');
  assert.equal(classesClaim('ru', 21), '21 класс героев.');
  assert.equal(classesClaim('ru', 22), '22 класса героев.');
  assert.equal(classesClaim('en', 1), '1 hero class.');
  assert.equal(classesClaim('en', classes), classes + ' hero classes.');
  assert.equal(classesClaim('zh', 17), '17 个英雄职业。');
});

test('the guest home and its translations carry no donate, wallet, crypto or Ekza text', async () => {
  const { landingTranslations, landingMetadata } = await importTs('../src/lib/landing-translations.ts');
  for (const [source, { ru, zh }] of Object.entries(landingTranslations)) {
    for (const text of [source, ru, zh]) assert.doesNotMatch(text, FORBIDDEN, text);
    assert.ok(ru.trim() && zh.trim(), source);
    assert.match(zh, /[㐀-鿿]/u, 'Chinese translation missing for ' + source);
  }
  for (const locale of ['en', 'ru', 'zh']) {
    const meta = landingMetadata(locale, 17);
    assert.doesNotMatch(meta.title + meta.description, FORBIDDEN);
  }
  assert.match(landingMetadata('ru', 17).description, /^17 классов героев\. Рейтинговые и обычные матчи/);
  for (const file of ['guest-home.tsx', 'releases.tsx']) {
    const source = await readFile(new URL('../src/components/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, FORBIDDEN, file);
    // Every mode is a translated string.
    for (const match of source.matchAll(/\[\s*'([^']+)',\s*'([^']+)'\s*\]/g))
      for (const text of [match[1], match[2]]) assert.ok(landingTranslations[text]?.ru && landingTranslations[text]?.zh, text);
  }
  // The mode names are the game's own (client/i18n queue.json, home.json).
  assert.equal(landingTranslations['Ranked'].ru, 'Рейтинговый');
  assert.equal(landingTranslations['Casual PvP'].ru, 'Обычный PvP');
  assert.equal(landingTranslations['vs Bots'].ru, 'Против ботов');
  assert.equal(landingTranslations['Offline practice'].ru, 'Офлайн-тренировка');
});
