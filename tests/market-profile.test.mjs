import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import {
  DEFAULT_MARKET, FEATURES, MARKETS, MARKET_PRESETS, MARKET_VARIABLE, assertBuiltMarket, assertMarket, describeMarket,
  marketFeatures, marketLocale, marketName, marketProblems, marketProfile, routeEnabled, routeFeature, vkIdClientId, vkSignInClientId,
} from '../src/lib/market-profile.mjs';
import { GUEST_LINKS, MOBILE_NAV, PORTAL_NAV, portalLoginHref, portalNav, portalReturnTo } from '../src/lib/navigation.mjs';
import { allowedPath } from '../src/lib/security.mjs';
import { resolveLocale } from '../src/lib/locale.mjs';

// Written out by hand from the game's shared/src/market.rs, independent of the module.
const GLOBAL = { ekza: true, supporter: true, vkSignIn: false };
const RU = { ekza: false, supporter: false, vkSignIn: true };
const CN = { ekza: false, supporter: false, vkSignIn: false };
const EKZA_PAGES = ['/creators', '/market', '/sponsor'];
const SUPPORTER_PAGES = ['/supporter', '/supporters'];

test('the market switch defaults to global and accepts only global, ru or cn', () => {
  assert.equal(MARKET_VARIABLE, 'OMOBA_MARKET');
  assert.equal(DEFAULT_MARKET, 'global');
  assert.deepEqual([...MARKETS], ['global', 'ru', 'cn']);
  assert.equal(marketName({}), 'global');
  assert.equal(marketName({ OMOBA_MARKET: '' }), 'global');
  for (const market of ['global', 'ru', 'cn']) assert.equal(marketName({ OMOBA_MARKET: market }), market);
  // The same refusals as market.rs: exact, case-sensitive, no trimming.
  for (const value of ['RU', 'eu', 'ru ', ' ru', 'russia', 'china', 'Global', 'GLOBAL', 'world', 'zh', 'cn\n'])
    assert.throws(() => marketName({ OMOBA_MARKET: value }), /OMOBA_MARKET must be empty, "global", "ru" or "cn"/, JSON.stringify(value));
});

test('presets keep Ekza and payments out of ru and cn, and only ru signs in with VK ID', () => {
  assert.deepEqual({ ...MARKET_PRESETS.global }, GLOBAL);
  assert.deepEqual({ ...MARKET_PRESETS.ru }, RU);
  assert.deepEqual({ ...MARKET_PRESETS.cn }, CN);
  assert.ok(Object.isFrozen(MARKET_PRESETS) && Object.values(MARKET_PRESETS).every(Object.isFrozen));
  assert.deepEqual({ ...marketFeatures({}) }, GLOBAL);
  assert.deepEqual({ ...marketFeatures({ OMOBA_MARKET: 'ru' }) }, RU);
  assert.deepEqual({ ...marketFeatures({ OMOBA_MARKET: 'cn' }) }, CN);
});

test('feature overrides have the game\'s names and on/off semantics and refuse typos', () => {
  // market.rs: OMOBA_FEATURE_{KEY}, keys ekza, supporter, vk_sign_in.
  assert.deepEqual(FEATURES.map(f => [f.key, f.env]), [
    ['ekza', 'OMOBA_FEATURE_EKZA'], ['supporter', 'OMOBA_FEATURE_SUPPORTER'], ['vk_sign_in', 'OMOBA_FEATURE_VK_SIGN_IN'],
  ]);
  for (const f of FEATURES) assert.equal(f.env, 'OMOBA_FEATURE_' + f.key.toUpperCase());
  assert.deepEqual({ ...marketFeatures({ OMOBA_MARKET: 'ru', OMOBA_FEATURE_EKZA: 'on', OMOBA_FEATURE_VK_SIGN_IN: '' }) }, { ekza: true, supporter: false, vkSignIn: true });
  assert.deepEqual({ ...marketFeatures({ OMOBA_FEATURE_SUPPORTER: 'off' }) }, { ekza: true, supporter: false, vkSignIn: false });
  assert.deepEqual({ ...marketFeatures({ OMOBA_MARKET: 'cn', OMOBA_FEATURE_VK_SIGN_IN: 'on' }) }, { ekza: false, supporter: false, vkSignIn: true });
  assert.deepEqual({ ...marketFeatures({ OMOBA_MARKET: 'ru', OMOBA_FEATURE_VK_SIGN_IN: 'off' }) }, CN);
  for (const [variable, value] of [['OMOBA_FEATURE_EKZA', 'yes'], ['OMOBA_FEATURE_SUPPORTER', 'OFF'], ['OMOBA_FEATURE_VK_SIGN_IN', '1'], ['OMOBA_FEATURE_EKZA', 'true'], ['OMOBA_FEATURE_EKZA', ' on']])
    assert.throws(() => marketFeatures({ OMOBA_MARKET: 'ru', [variable]: value }), new RegExp(variable + ' must be empty, "on" or "off"'), variable + '=' + value);
});

test('one describe line, as in market.rs, and a build only runs as the market it was built for', () => {
  assert.equal(describeMarket(marketProfile({ OMOBA_MARKET: 'ru' })), 'ru (ekza off, supporter off, vk_sign_in on)');
  assert.equal(describeMarket(marketProfile({})), 'global (ekza on, supporter on, vk_sign_in off)');
  assert.equal(describeMarket(marketProfile({ OMOBA_MARKET: 'cn', OMOBA_FEATURE_EKZA: 'on' })), 'cn (ekza on, supporter off, vk_sign_in off)');
  const ru = marketProfile({ OMOBA_MARKET: 'ru' });
  assert.doesNotThrow(() => assertBuiltMarket('ru (ekza off, supporter off, vk_sign_in on)', ru));
  assert.throws(() => assertBuiltMarket('global (ekza on, supporter on, vk_sign_in off)', ru), /OMOBA market mismatch, refusing to serve \(fail closed\): this build was made for global .* but runs as ru/);
  // An override flipped after the build is a mismatch too: route gating is baked in.
  assert.throws(() => assertBuiltMarket('ru (ekza off, supporter off, vk_sign_in on)', marketProfile({ OMOBA_MARKET: 'ru', OMOBA_FEATURE_EKZA: 'on' })), /mismatch/);
  assert.throws(() => assertBuiltMarket(undefined, ru), /made for <unknown>/);
});

test('a misconfigured market fails closed with every problem listed', () => {
  assert.deepEqual(marketProblems({}), []);
  assert.deepEqual(marketProblems({ OMOBA_MARKET: 'ru', OMOBA_VKID_CLIENT_ID: '12345' }), []);
  const problems = marketProblems({ OMOBA_MARKET: 'eu', OMOBA_FEATURE_SUPPORTER: 'no', OMOBA_VKID_CLIENT_ID: 'abc' });
  assert.equal(problems.length, 3);
  assert.throws(() => assertMarket({ OMOBA_MARKET: 'eu', OMOBA_FEATURE_SUPPORTER: 'no' }),
    (error) => /^OMOBA market misconfigured, refusing to build or serve \(fail closed\):\n {2}- OMOBA_MARKET .*\n {2}- OMOBA_FEATURE_SUPPORTER /.test(error.message));
  assert.deepEqual(assertMarket({ OMOBA_MARKET: 'cn' }).market, 'cn');
});

test('VK ID is offered only with the feature and a numeric app id', () => {
  assert.equal(vkIdClientId({}), null);
  assert.equal(vkIdClientId({ OMOBA_VKID_CLIENT_ID: '' }), null);
  assert.equal(vkIdClientId({ OMOBA_VKID_CLIENT_ID: '54321987' }), '54321987');
  for (const value of ['abc', '0123', ' 1', '1 ', '-5', '1e5', '1'.repeat(21)])
    assert.throws(() => vkIdClientId({ OMOBA_VKID_CLIENT_ID: value }), /OMOBA_VKID_CLIENT_ID must be the numeric VK ID app id/, value);
  assert.equal(vkSignInClientId({ OMOBA_MARKET: 'ru', OMOBA_VKID_CLIENT_ID: '12345' }), '12345');
  assert.equal(vkSignInClientId({ OMOBA_MARKET: 'ru' }), null);
  assert.equal(vkSignInClientId({ OMOBA_VKID_CLIENT_ID: '12345' }), null);
  assert.equal(vkSignInClientId({ OMOBA_MARKET: 'ru', OMOBA_FEATURE_VK_SIGN_IN: 'off', OMOBA_VKID_CLIENT_ID: '12345' }), null);
  assert.equal(vkSignInClientId({ OMOBA_MARKET: 'cn', OMOBA_FEATURE_VK_SIGN_IN: 'on', OMOBA_VKID_CLIENT_ID: '12345' }), '12345');
});

test('pages belong to their feature; nested paths follow their page', () => {
  for (const page of EKZA_PAGES) assert.equal(routeFeature(page), 'ekza');
  for (const page of SUPPORTER_PAGES) assert.equal(routeFeature(page), 'supporter');
  assert.equal(routeFeature('/market/item'), 'ekza');
  for (const page of ['/me', '/workshop', '/connect', '/devices', '/marketplace', '/supporterx', '/login']) assert.equal(routeFeature(page), null, page);
  for (const page of [...EKZA_PAGES, ...SUPPORTER_PAGES]) {
    assert.equal(routeEnabled(page, GLOBAL), true);
    assert.equal(routeEnabled(page, RU), false);
    assert.equal(routeEnabled(page, CN), false);
  }
  assert.equal(routeEnabled('/supporters', { ...GLOBAL, supporter: false }), false);
  assert.equal(routeEnabled('/market', { ...GLOBAL, supporter: false }), true);
});

test('nav, mobile nav and guest buttons show only the pages of the market', () => {
  assert.deepEqual(portalNav(PORTAL_NAV, GLOBAL), [...PORTAL_NAV]);
  assert.deepEqual(portalNav(PORTAL_NAV), [...PORTAL_NAV]);
  const free = ['/me', '/me/matches', '/me/stats', '/players', '/friends', '/workshop', '/devices', '/settings'];
  assert.deepEqual(portalNav(PORTAL_NAV, RU), free);
  assert.deepEqual(portalNav(PORTAL_NAV, CN), free);
  assert.deepEqual(portalNav(MOBILE_NAV, RU), ['/me', '/me/matches', '/workshop', '/friends']);
  assert.deepEqual(portalNav(GUEST_LINKS, GLOBAL), ['/creators', '/sponsor', '/market']);
  assert.deepEqual(portalNav(GUEST_LINKS, RU), []);
  assert.deepEqual(portalNav(PORTAL_NAV, { ...GLOBAL, supporter: false }), PORTAL_NAV.filter(p => !SUPPORTER_PAGES.includes(p)));
  assert.deepEqual(portalNav(PORTAL_NAV, { ...RU, ekza: true }), PORTAL_NAV.filter(p => !SUPPORTER_PAGES.includes(p)));
});

test('sign-in destinations drop pages the market does not serve and keep only the /connect code', () => {
  for (const page of [...EKZA_PAGES, ...SUPPORTER_PAGES]) {
    assert.equal(portalReturnTo(page, GLOBAL), page);
    assert.equal(portalReturnTo(page, RU), '/me');
    assert.equal(portalReturnTo(page + '?x=1', CN), '/me');
  }
  assert.equal(new URL(portalLoginHref('/market', RU), 'https://app.omoba.io').searchParams.get('returnTo'), '/me');
  for (const features of [GLOBAL, RU, CN]) {
    assert.equal(portalReturnTo('/connect?code=ABCD2345', features), '/connect?code=ABCD2345');
    assert.equal(portalReturnTo('/workshop', features), '/workshop');
  }
  for (const bad of ['/connect', '/connect?code=', '/connect?code=abcd2345', '/connect?code=ABCD234', '/connect?code=ABCD23456',
    '/connect?code=ABCD1345', '/connect?code=ABCD0345', '/connect?code=ABCD2345&returnTo=//evil.example', '/connect?x=1&code=ABCD2345',
    '/connect?code=ABCD2345&code=WXYZ2345', '/connect?code=ABCD%2B345', '/connect/extra?code=ABCD2345', '/connect?code=ABCD2345#frag'])
    assert.equal(portalReturnTo(bad, RU), '/me', bad);
});

test('the Account API allowlist follows the features: Ekza library, Supporter and VK ID routes', () => {
  const ekzaRoutes = [['me/ekza-library', 'GET'], ['me/ekza-library/connect', 'POST'], ['me/ekza-library/poll', 'POST'], ['me/ekza-library', 'DELETE']];
  const supporterRoutes = [['me/supporter', 'GET'], ['me/supporter/solana/orders', 'GET'], ['me/supporter/solana/checkout', 'POST'], ['me/supporter/solana/confirm', 'POST'],
    ['me/supporter/aura', 'PATCH'], ['me/supporter/recognition', 'PATCH'], ['supporters', 'GET']];
  const socialRoutes = [['auth/social/attach', 'POST'], ['auth/social/ticket', 'POST'], ['me/social/vk', 'DELETE']];
  const always = [['me', 'GET'], ['me/devices/lookup', 'POST'], ['me/devices/approve', 'POST'], ['auth/logout', 'POST'], ['auth/pairings', 'POST'], ['releases', 'GET'], ['me/class-builds', 'GET']];
  for (const [features, ekza, supporter, vk] of [[GLOBAL, true, true, false], [RU, false, false, true], [CN, false, false, false], [{ ...RU, ekza: true }, true, false, true]]) {
    for (const [path, method] of ekzaRoutes) assert.equal(allowedPath(path, method, features), ekza, path);
    for (const [path, method] of supporterRoutes) assert.equal(allowedPath(path, method, features), supporter, path);
    for (const [path, method] of socialRoutes) assert.equal(allowedPath(path, method, features), vk, path);
    for (const [path, method] of always) assert.equal(allowedPath(path, method, features), true, path);
  }
  // Only the exact VK ID routes and methods; the exchange itself is server-to-server.
  for (const [path, method] of [['auth/social/vk', 'POST'], ['auth/social/attach', 'GET'], ['auth/social/ticket', 'GET'], ['auth/social/link', 'POST'],
    ['me/social/vk', 'GET'], ['me/social/ok', 'DELETE'], ['me/social', 'GET'], ['auth/social/attach/x', 'POST']])
    assert.equal(allowedPath(path, method, RU), false, method + ' ' + path);
});

test('without explicit features the allowlist uses the running server\'s market (fail closed)', () => {
  const saved = process.env.OMOBA_MARKET;
  try {
    process.env.OMOBA_MARKET = 'ru';
    assert.equal(allowedPath('me/ekza-library', 'GET'), false);
    assert.equal(allowedPath('me/supporter', 'GET'), false);
    assert.equal(allowedPath('auth/social/attach', 'POST'), true);
    delete process.env.OMOBA_MARKET;
    assert.equal(allowedPath('me/ekza-library', 'GET'), true);
    assert.equal(allowedPath('auth/social/attach', 'POST'), false);
  } finally {
    if (saved === undefined) delete process.env.OMOBA_MARKET; else process.env.OMOBA_MARKET = saved;
  }
});

test('ru and cn fall back to their language instead of the IP country; a manual choice still wins', () => {
  assert.equal(marketLocale('global'), null);
  assert.equal(marketLocale('ru'), 'ru');
  assert.equal(marketLocale('cn'), 'zh');
  assert.equal(resolveLocale({ market: 'ru' }), 'ru');
  assert.equal(resolveLocale({ market: 'ru', country: 'US' }), 'ru');
  assert.equal(resolveLocale({ market: 'ru', country: 'CN' }), 'ru');
  assert.equal(resolveLocale({ market: 'cn' }), 'zh');
  assert.equal(resolveLocale({ market: 'cn', country: 'RU' }), 'zh');
  assert.equal(resolveLocale({ market: 'ru', cookie: 'en', acceptLanguage: 'ru' }), 'en');
  assert.equal(resolveLocale({ market: 'cn', cookie: 'ru' }), 'ru');
  // An explicit browser language still counts before the market fallback.
  assert.equal(resolveLocale({ market: 'ru', acceptLanguage: 'zh-CN' }), 'zh');
  assert.equal(resolveLocale({ market: 'ru', acceptLanguage: 'fr-FR' }), 'ru');
  // Global keeps its country heuristic and English default.
  assert.equal(resolveLocale({ market: 'global', country: 'RU' }), 'ru');
  assert.equal(resolveLocale({ market: 'global' }), 'en');
  assert.equal(resolveLocale({ country: 'CN' }), 'zh');
});

test('next.config inlines the built market and refuses a misconfigured one', async () => {
  const source = stripTypeScriptTypes(await readFile(new URL('../next.config.ts', import.meta.url), 'utf8'))
    .replace("'./src/lib/contour-guard.mjs'", JSON.stringify(new URL('../src/lib/contour-guard.mjs', import.meta.url).href))
    .replace("'./src/lib/market-profile.mjs'", JSON.stringify(new URL('../src/lib/market-profile.mjs', import.meta.url).href));
  const saved = { ...process.env };
  const load = async (env, tag) => {
    for (const key of Object.keys(process.env)) if (key.startsWith('OMOBA_') || key.startsWith('VERCEL')) delete process.env[key];
    Object.assign(process.env, env);
    try {
      return (await import('data:text/javascript;base64,' + Buffer.from(source + '\n// market ' + tag).toString('base64'))).default;
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  };
  const base = { OMOBA_PORTAL_ORIGIN: 'https://app.omoba.io', OMOBA_ACCOUNT_MODE: 'disabled' };
  assert.equal((await load(base, 'global')).env.OMOBA_BUILT_MARKET, 'global (ekza on, supporter on, vk_sign_in off)');
  const ru = await load({ ...base, OMOBA_MARKET: 'ru', OMOBA_VKID_CLIENT_ID: '12345' }, 'ru');
  assert.deepEqual(ru.env, { OMOBA_BUILT_CONTOUR: 'production', OMOBA_BUILT_MARKET: 'ru (ekza off, supporter off, vk_sign_in on)' });
  // The VK ID app id is a runtime setting, never inlined into a bundle.
  assert.doesNotMatch(JSON.stringify(ru), /12345/);
  await assert.rejects(load({ ...base, OMOBA_MARKET: 'RU' }, 'typo'), /OMOBA market misconfigured/);
  await assert.rejects(load({ ...base, OMOBA_MARKET: 'ru', OMOBA_FEATURE_EKZA: 'yes' }, 'feature'), /OMOBA_FEATURE_EKZA must be/);
  await assert.rejects(load({ ...base, OMOBA_MARKET: 'ru', OMOBA_VKID_CLIENT_ID: 'vk-app' }, 'client'), /OMOBA_VKID_CLIENT_ID must be/);
  // Independent axes: a dev-contour error still reports as a contour error.
  await assert.rejects(load({ OMOBA_MARKET: 'ru', OMOBA_CONTOUR: 'staging' }, 'contour'), /OMOBA_CONTOUR must be/);
});

test('instrumentation checks the built market at startup, next to the contour', async () => {
  const source = await readFile(new URL('../src/instrumentation.ts', import.meta.url), 'utf8');
  assert.match(source, /assertBuiltContour\(process\.env\.OMOBA_BUILT_CONTOUR, assertContour\(process\.env\)\)/);
  assert.match(source, /assertBuiltMarket\(process\.env\.OMOBA_BUILT_MARKET, assertMarket\(process\.env\)\)/);
});
