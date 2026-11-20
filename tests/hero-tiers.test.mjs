// Hero tiers on the portal (LR-67): the tier table and prices, custom amounts, the quote
// the browser sends, receipt e-mails, the step-down, the BFF's per-attempt
// Idempotency-Key, and no Solana, Apple, crypto or Ekza text on the RU page.
// With OMOBA_GAME_REPO=<omoba-bevy checkout> it also compares the table with the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import {
  AURA_NAMES, AURA_STYLES, BASE_STYLES, GRANT_DAYS, KOPECKS, MAX_RUB, MIN_RUB, TIERS, TIER_AMOUNTS_RUB, amountAllowed, auraName, formatRubles,
  parseRubles, pointsAt, quoteFor, receiptEmail, styleUnlocked, tierFor, tierOfStyle, tierSteps,
} from '../src/lib/hero-tiers.mjs';
import {
  CHECKOUT_COOKIE_SECONDS, CHECKOUT_PATH, PAYMENTS_PATH, attemptFinished, attemptId, checkoutAttempt, checkoutCookie, checkoutFingerprint, checkoutFinished,
  checkoutRequest, confirmationUrl, newCheckoutKey, parseCheckoutCookie,
} from '../src/lib/checkout-attempt.mjs';

const DAY = 86400;
const OFFER = { currency: 'RUB', duration_days: 30 };
// Written out by hand from shared/src/supporter.rs (`SupporterTier::points`) and the offer.
const LADDER = [['rose', 100], ['jade', 250], ['azure', 500], ['crimson', 1000], ['prism_i', 2500], ['prism_ii', 5000], ['prism_iii', 10000]];

test('seven tiers, lowest first, at the monthly ruble ladder; the page offers the same amounts', () => {
  assert.deepEqual(TIERS.map(tier => [tier.id, tier.points]), LADDER);
  assert.deepEqual([...TIER_AMOUNTS_RUB], [100, 250, 500, 1000, 2500, 5000, 10000]);
  assert.deepEqual([...AURA_STYLES], ['solar', 'lunar', 'verdant', 'rose', 'jade', 'azure', 'crimson', 'prism_i', 'prism_ii', 'prism_iii']);
  assert.equal(KOPECKS, 100); assert.equal(MIN_RUB, 100); assert.equal(MAX_RUB, 100000); assert.equal(GRANT_DAYS, 30);
  assert.ok(Object.isFrozen(TIERS) && TIERS.every(Object.isFrozen));
  for (const [points, tier] of [[0, null], [99, null], [100, 'rose'], [249, 'rose'], [250, 'jade'], [499, 'jade'], [500, 'azure'], [999, 'azure'], [1000, 'crimson'],
    [2499, 'crimson'], [2500, 'prism_i'], [4999, 'prism_i'], [5000, 'prism_ii'], [9999, 'prism_ii'], [10000, 'prism_iii'], [4294967295, 'prism_iii'], [Number.NaN, null]])
    assert.equal(tierFor(points)?.id ?? null, tier, String(points));
  assert.equal(tierOfStyle('crimson')?.points, 1000);
  assert.equal(tierOfStyle('solar'), null);
  // Solid tiers have a colour; the Prism tiers shimmer, each faster than the one below.
  for (const tier of TIERS) assert.ok(tier.prism === null ? /^#[0-9a-f]{6}$/.test(tier.color) : tier.color === null && tier.prism > 0, tier.id);
  const speeds = TIERS.filter(tier => tier.prism).map(tier => tier.prism);
  assert.deepEqual(speeds, [...speeds].sort((a, b) => a - b));
});

test('a custom amount is a whole number of rubles from 100 to 100 000', () => {
  for (const ok of [100, 101, 1234, 100000]) assert.equal(amountAllowed(ok), true, String(ok));
  for (const bad of [99, 0, -100, 100001, 150.5, Number.NaN, '100', null, 1e21]) assert.equal(amountAllowed(bad), false, String(bad));
  for (const [input, rub] of [['100', 100], ['1500', 1500], [' 2500 ', 2500], ['10 000', 10000], ['100 000', 100000], ['1 234', 1234]])
    assert.equal(parseRubles(input), rub, JSON.stringify(input));
  for (const bad of ['', '99', '100001', '0100', '1e3', '-500', '150.5', '150,5', '1 0 0 0 0 0 0', 'сто', '1000₽', 1000, null])
    assert.equal(parseRubles(bad), null, JSON.stringify(bad));
});

test('the quote is exactly the Account API\'s quote(amount_rub)', () => {
  // account-api/src/supporter/yookassa/checkout.rs `the_quote_names_amount_period_and_tier`.
  assert.deepEqual(quoteFor(1000, OFFER), { amount_minor: 100000, currency: 'RUB', duration_days: 30, tier: 'crimson' });
  assert.equal(quoteFor(100, OFFER).tier, 'rose');
  assert.equal(quoteFor(2499, OFFER).tier, 'crimson');
  assert.equal(quoteFor(100000, OFFER).tier, 'prism_iii');
  for (const [tier, points] of LADDER) assert.deepEqual(quoteFor(points, OFFER), { amount_minor: points * 100, currency: 'RUB', duration_days: 30, tier });
  assert.deepEqual(Object.keys(quoteFor(1234, OFFER)), ['amount_minor', 'currency', 'duration_days', 'tier']);
  // The period and currency are the server's offer: a changed offer changes the quote (409 reload otherwise).
  assert.equal(quoteFor(500, { currency: 'RUB', duration_days: 31 }).duration_days, 31);
});

test('receipt e-mails follow the Account API\'s rule', () => {
  // checkout.rs `receipt_emails_are_plain_addresses`.
  assert.equal(receiptEmail('  donor@example.ru '), 'donor@example.ru');
  assert.equal(receiptEmail('a.b+c@mail.example.org'), 'a.b+c@mail.example.org');
  for (const bad of ['', 'donor', 'donor@', '@example.ru', 'donor@example', 'donor@.ru', 'donor@example.', 'do nor@example.ru', 'donor@exa@mple.ru',
    'donor@exam\nple.ru', 'donor\u0007@example.ru', 'a'.repeat(250) + '@example.ru', null, 42])
    assert.equal(receiptEmail(bad), null, JSON.stringify(bad));
});

const grant = (from, until, points, revoked = false) => ({ provider: 'yookassa', valid_from: from, valid_until: until, revoked, renewal_enabled: false, tier_points: points });

test('the tier is the 30-day sum; the step-down walks the grant ends, expiry and refunds included', () => {
  const now = 100 * DAY;
  // 1000 ₽ ten days ago and 250 ₽ today: Crimson until the first ends, then Jade.
  const first = grant(now - 10 * DAY, now + 20 * DAY, 1000), second = grant(now, now + 30 * DAY, 250);
  const expired = grant(now - 40 * DAY, now - 10 * DAY, 5000), refunded = grant(now - DAY, now + 29 * DAY, 2500, true);
  const grants = [first, second, expired, refunded];
  assert.equal(pointsAt(grants, now), 1250);
  const status = { active: true, active_until: now + 30 * DAY, grants, tier_points: 1250, tier_until: now + 20 * DAY };
  assert.deepEqual(tierSteps(status, now), [{ tier: 'crimson', until: now + 20 * DAY }, { tier: 'jade', until: now + 30 * DAY }]);
  // 100 ₽ every month keeps Rose: the next month's payment overlaps the last one, so the
  // server's tier_until is the end of the newer payment and nothing steps down before it.
  const monthly = [grant(now - 29 * DAY, now + DAY, 100), grant(now, now + 30 * DAY, 100)];
  assert.equal(pointsAt(monthly, now), 200);
  assert.deepEqual(tierSteps({ active: true, active_until: now + 30 * DAY, grants: monthly, tier_points: 200, tier_until: now + 30 * DAY }, now), [{ tier: 'rose', until: now + 30 * DAY }]);
  // A partial refund lowers that grant's points (the server recomputes them): 1000 → 400 is Azure with the 250.
  const partial = [grant(now - 10 * DAY, now + 20 * DAY, 400), second];
  assert.deepEqual(tierSteps({ active: true, active_until: now + 30 * DAY, grants: partial, tier_points: 650, tier_until: now + 20 * DAY }, now),
    [{ tier: 'azure', until: now + 20 * DAY }, { tier: 'jade', until: now + 30 * DAY }]);
  // No tier: below 100 points, no active grant, or a tier that already ended.
  assert.deepEqual(tierSteps({ active: true, active_until: now + DAY, grants: [grant(now - DAY, now + DAY, 0)], tier_points: 0, tier_until: null }, now), []);
  assert.deepEqual(tierSteps({ ...status, active: false }, now), []);
  assert.deepEqual(tierSteps({ ...status, tier_until: now }, now), []);
});

test('base styles need any active grant; each tier style needs its tier', () => {
  const status = (points, active = true) => ({ active, active_until: active ? 1e10 : null, grants: [], tier_points: points });
  for (const base of BASE_STYLES) {
    assert.equal(styleUnlocked(base.id, status(0)), true, base.id);
    assert.equal(styleUnlocked(base.id, status(0, false)), false, base.id);
  }
  assert.equal(styleUnlocked('crimson', status(1000)), true);
  assert.equal(styleUnlocked('prism_i', status(1000)), false);
  assert.equal(styleUnlocked('prism_iii', status(10000)), true);
  assert.equal(styleUnlocked('rose', status(10000, false)), false);
  assert.equal(styleUnlocked('admin', status(10000)), false);
});

test('style names are the game\'s in every language; amounts are shown in rubles', () => {
  for (const locale of ['en', 'ru', 'zh']) assert.deepEqual(Object.keys(AURA_NAMES[locale]), [...AURA_STYLES], locale);
  assert.equal(auraName('crimson', 'ru'), 'Багрянец');
  assert.equal(auraName('prism_iii', 'zh'), '流光 III');
  assert.equal(auraName('unknown', 'ru'), 'unknown');
  assert.equal(formatRubles(100000, 'ru-RU').replace(/\s/g, ' '), '1 000 ₽');
  assert.equal(formatRubles(123456, 'ru-RU').replace(/\s/g, ' '), '1 234,56 ₽');
  assert.equal(formatRubles(250000, 'en-GB'), '₽2,500');
});

const REQUEST = { amount_rub: 1000, receipt_email: ' donor@example.ru ', quote: { amount_minor: 100000, currency: 'RUB', duration_days: 30, tier: 'crimson' }, offer_version: '0-draft' };

test('the BFF accepts exactly the checkout body and keeps one Idempotency-Key per attempt', () => {
  assert.equal(CHECKOUT_PATH, 'me/supporter/yookassa/checkout');
  assert.equal(PAYMENTS_PATH, 'me/supporter/yookassa/payments');
  assert.equal(CHECKOUT_COOKIE_SECONDS, 3600);
  const request = checkoutRequest(REQUEST);
  assert.deepEqual(request, { amountRub: 1000, email: 'donor@example.ru', offerVersion: '0-draft' });
  for (const bad of [null, [], 'x', { ...REQUEST, extra: 1 }, { ...REQUEST, amount_rub: 99 }, { ...REQUEST, amount_rub: '1000' }, { ...REQUEST, receipt_email: 'nobody' },
    { ...REQUEST, quote: null }, { ...REQUEST, quote: [] }, { ...REQUEST, offer_version: '' }, { ...REQUEST, offer_version: 'a/b' }, { amount_rub: 1000, receipt_email: 'a@b.ru', quote: {} }])
    assert.equal(checkoutRequest(bad), null, JSON.stringify(bad));
  // The attempt is the session, amount, e-mail and offer (the quote is the API's check).
  const fingerprint = checkoutFingerprint('a'.repeat(64), request);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(checkoutFingerprint('a'.repeat(64), checkoutRequest({ ...REQUEST, receipt_email: 'donor@example.ru', quote: { other: true } })), fingerprint);
  for (const other of [{ ...REQUEST, amount_rub: 1001 }, { ...REQUEST, receipt_email: 'other@example.ru' }, { ...REQUEST, offer_version: '1' }])
    assert.notEqual(checkoutFingerprint('a'.repeat(64), checkoutRequest(other)), fingerprint);
  assert.notEqual(checkoutFingerprint('b'.repeat(64), request), fingerprint, 'another session is another attempt');
  // A retry of the same attempt keeps the key (and the attempt id); another attempt gets a new one.
  const first = checkoutAttempt(null, fingerprint, () => 'k'.repeat(64));
  assert.deepEqual(first, { key: 'k'.repeat(64), fingerprint, attempt: null, reused: false });
  const saved = parseCheckoutCookie(checkoutCookie({ key: 'c'.repeat(64), fingerprint, attempt: 'd'.repeat(32) }));
  assert.deepEqual(saved, { key: 'c'.repeat(64), fingerprint, attempt: 'd'.repeat(32) });
  assert.deepEqual(checkoutAttempt(saved, fingerprint), { ...saved, reused: true });
  const next = checkoutAttempt(saved, checkoutFingerprint('a'.repeat(64), checkoutRequest({ ...REQUEST, amount_rub: 500 })));
  assert.equal(next.reused, false); assert.notEqual(next.key, saved.key); assert.equal(next.attempt, null);
  // The key the Account API accepts: 16-80 of [A-Za-z0-9-]; ours is 64 hex, never repeated.
  const key = newCheckoutKey();
  assert.match(key, /^[0-9a-f]{64}$/); assert.notEqual(newCheckoutKey(), key);
  for (const bad of ['', 'x', 'c'.repeat(64), 'c'.repeat(64) + '.' + 'z'.repeat(64), 'C'.repeat(64) + '.' + fingerprint, 'c'.repeat(64) + '.' + fingerprint + '.short', 'c'.repeat(64) + '.' + fingerprint + '.' + 'd'.repeat(32) + '.x', undefined])
    assert.equal(parseCheckoutCookie(bad), null, JSON.stringify(bad));
});

test('the BFF forgets the key when the attempt is over and forwards only an HTTPS redirect', () => {
  for (const code of ['payment_succeeded', 'payment_canceled', 'payment_manual_review', 'idempotency_conflict']) assert.equal(checkoutFinished(409, code), true, code);
  // A quote mismatch, a payment still in progress, a pause or a lost reply keep the attempt.
  for (const [status, code] of [[409, 'reload'], [409, 'payment_in_progress'], [409, 'too_many_open_payments'], [503, 'new_charges_paused'], [503, 'account_service_unavailable'], [400, 'amount_not_allowed'], [200, undefined]])
    assert.equal(checkoutFinished(status, code), false, status + ' ' + code);
  const attempt = 'd'.repeat(32);
  for (const status of ['succeeded', 'canceled', 'review']) assert.equal(attemptFinished({ payments: [{ attempt_id: attempt, status }] }, attempt), true, status);
  assert.equal(attemptFinished({ payments: [{ attempt_id: attempt, status: 'pending' }] }, attempt), false);
  assert.equal(attemptFinished({ payments: [{ attempt_id: 'e'.repeat(32), status: 'succeeded' }] }, attempt), false);
  assert.equal(attemptFinished({ payments: [{ attempt_id: attempt, status: 'succeeded' }] }, null), false);
  assert.equal(attemptFinished({ payments: 'x' }, attempt), false);
  assert.equal(attemptId(attempt), attempt); assert.equal(attemptId('x'), null); assert.equal(attemptId(7), null);
  assert.equal(confirmationUrl('https://yoomoney.ru/checkout/payments/v2/contract?orderId=1'), 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=1');
  for (const bad of ['http://yoomoney.ru/pay', 'https://user:pass@yoomoney.ru/pay', 'javascript:alert(1)', '/supporter', '', null, 'https://' + 'a'.repeat(2050)])
    assert.equal(confirmationUrl(bad), null, String(bad).slice(0, 40));
});

/** Text that must never reach an RU page: Solana, Apple, crypto, wallets, Ekza, donation wording. */
const FORBIDDEN = /solana|apple|app store|crypto(?!graph)|криптовалют|wallet|кошел[её]к|ekza|usdc|\/donate|donat|донат/i;
const root = new URL('../', import.meta.url);

test('the RU Supporter page and its translations carry no Solana, Apple, crypto or Ekza text', async () => {
  const component = await readFile(new URL('src/components/hero-tiers.tsx', root), 'utf8');
  assert.doesNotMatch(component.replace(/^import .*$/gm, ''), FORBIDDEN);
  const source = stripTypeScriptTypes(await readFile(new URL('src/lib/hero-tier-translations.ts', root), 'utf8'));
  const { heroTierTranslations } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  for (const [english, { ru, zh }] of Object.entries(heroTierTranslations)) for (const text of [english, ru, zh]) assert.doesNotMatch(text, FORBIDDEN, text);
  for (const names of Object.values(AURA_NAMES)) for (const name of Object.values(names)) assert.doesNotMatch(name, FORBIDDEN);
  // Every visible string of the page is translated (the shared check is tests/locale.test.mjs).
  for (const match of component.matchAll(/\bt\((['"])([^'"\n]+)\1\)/g)) assert.ok(match[2] in heroTierTranslations || !/\{/.test(match[2]), match[2]);
  // The page never chooses the Idempotency-Key: the BFF does.
  assert.doesNotMatch(component, /Idempotency-Key'|randomUUID/);
});

test('the page polls the return five times, 1.5 s apart, and links the offer', async () => {
  const component = await readFile(new URL('src/components/hero-tiers.tsx', root), 'utf8');
  assert.match(component, /const RETURN_POLLS = 5, RETURN_INTERVAL_MS = 1500;/);
  assert.match(component, /href="\/offer"/);
  assert.match(component, /api<Dashboard>\('me\/supporter'\)/);
  const css = await readFile(new URL('src/app/globals.css', root), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.tier-aura\.prism \{ animation: none; \} \}/);
});

// Optional cross-check against the game: OMOBA_GAME_REPO=<omoba-bevy checkout>.
test('tiers, amounts, colours, speeds and names equal the game\'s when it is available', { skip: !process.env.OMOBA_GAME_REPO && 'set OMOBA_GAME_REPO to compare' }, async () => {
  const game = (path) => readFile(process.env.OMOBA_GAME_REPO + '/' + path, 'utf8');
  const shared = await game('shared/src/supporter.rs');
  const points = /pub const fn points\(self\) -> u32 \{\s*match self \{([\s\S]*?)\}\s*\}/.exec(shared)?.[1] ?? '';
  const names = { Rose: 'rose', Jade: 'jade', Azure: 'azure', Crimson: 'crimson', PrismI: 'prism_i', PrismII: 'prism_ii', PrismIII: 'prism_iii' };
  assert.deepEqual([...points.matchAll(/Self::(\w+) => (\d+),/g)].map(m => [names[m[1]], Number(m[2])]), LADDER);
  const yookassa = await game('account-api/src/supporter/yookassa.rs');
  assert.match(yookassa, /pub const TIER_AMOUNTS_RUB: \[i64; 7\] = \[100, 250, 500, 1000, 2500, 5000, 10000\];/);
  assert.match(yookassa, /pub const MIN_AMOUNT_MINOR: i64 = 100 \* KOPECKS;/);
  assert.match(yookassa, /pub const MAX_AMOUNT_MINOR: i64 = 100_000 \* KOPECKS;/);
  assert.match(yookassa, /pub const GRANT_SECONDS: i64 = 30 \* 86_400;/);
  const client = await game('client/src/supporter.rs');
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(Number(v) * 255).toString(16).padStart(2, '0')).join('');
  const colours = Object.fromEntries([...client.matchAll(/AuraStyle::(\w+) => Color::srgb\(([\d.]+), ([\d.]+), ([\d.]+)\),/g)].map(m => [m[1].toLowerCase(), hex(m[2], m[3], m[4])]));
  for (const style of [...BASE_STYLES, ...TIERS.filter(tier => tier.color)]) assert.equal(style.color, colours[style.id], style.id);
  const speeds = Object.fromEntries([...client.matchAll(/AuraStyle::(Prism\w+) => Some\(\(([\d.]+),/g)].map(m => [names[m[1]], Number(m[2])]));
  for (const tier of TIERS.filter(tier => tier.prism)) assert.equal(tier.prism, speeds[tier.id], tier.id);
  for (const [locale, folder] of [['en', 'en'], ['ru', 'ru'], ['zh', 'zh-Hans']]) {
    const aura = JSON.parse(await game('client/i18n/' + folder + '/aura.json'));
    for (const id of AURA_STYLES) assert.equal(AURA_NAMES[locale][id], aura['aura.' + id], locale + ' ' + id);
  }
});
