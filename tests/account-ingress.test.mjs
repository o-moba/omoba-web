import test from 'node:test';
import assert from 'node:assert/strict';
import { accountIngressHeaders, accountUpstreamHeaders, assertPortalConfig, portalConfig } from '../src/lib/security.mjs';
import { assertContour } from '../src/lib/contour-guard.mjs';
import { assertMarket, vkSignInClientId } from '../src/lib/market-profile.mjs';
const key = 'a'.repeat(64);
const hosted = { NODE_ENV: 'production', OMOBA_CONTOUR: 'dev', OMOBA_PORTAL_ORIGIN: 'https://app.dev.omoba.io',
  OMOBA_ACCOUNT_API_URL: 'https://account.dev.omoba.io', OMOBA_ACCOUNT_MODE: 'enabled', OMOBA_ACCOUNT_INGRESS_KEY: key };
// The RU host (game repo ops/vps/ru/portal.env.example): production contour, the
// loopback Account API on the same host, the player's address from Caddy's X-Real-IP.
const ru = { NODE_ENV: 'production', OMOBA_MARKET: 'ru', OMOBA_PORTAL_ORIGIN: 'https://app.ru.omoba.io',
  OMOBA_ACCOUNT_MODE: 'enabled', OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:40550', OMOBA_TRUST_LOOPBACK_PROXY: '1',
  OMOBA_VKID_CLIENT_ID: '51234567', PORT: '3010' };
const bad = ['', 'a'.repeat(63), 'A'.repeat(64), key + '\n', key + '00', ' ' + key];

test('hosted dev account access pins the exact origin and requires a bounded ingress key', () => {
  assert.equal(assertContour(hosted), 'dev');
  assert.equal(portalConfig(hosted).api, hosted.OMOBA_ACCOUNT_API_URL);
  assert.deepEqual(accountIngressHeaders(hosted), { 'X-Omoba-Portal-Key': key });
  assert.ok(!JSON.stringify(portalConfig(hosted)).includes(key), 'the public configuration object contains no credential');
  for (const value of bad)
    assert.throws(() => portalConfig({ ...hosted, OMOBA_ACCOUNT_INGRESS_KEY: value }), /INGRESS_KEY/);
  for (const url of ['https://account.omoba.io', 'https://api.dev.omoba.io', 'https://account.dev.omoba.io.evil.example',
    'https://account.dev.omoba.io:444', 'http://account.dev.omoba.io', 'https://account.dev.omoba.io/path',
    'https://user@account.dev.omoba.io', 'https://account.dev.omoba.io?secret=bad', 'http://127.0.0.1:40550'])
    assert.throws(() => portalConfig({ ...hosted, OMOBA_ACCOUNT_API_URL: url }), url);
  assert.throws(() => portalConfig({ ...hosted, OMOBA_CONTOUR: 'production' }), /dev-contour/);
});

test('ingress key is absent from disabled and loopback requests', () => {
  assert.deepEqual(accountIngressHeaders({ ...hosted, OMOBA_ACCOUNT_MODE: 'disabled' }), {});
  assert.deepEqual(accountIngressHeaders({ ...hosted, OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:40550' }), {});
  assert.deepEqual(accountIngressHeaders({ OMOBA_ACCOUNT_API_URL: 'http://localhost:40550', OMOBA_ACCOUNT_INGRESS_KEY: key }), {});
  assert.deepEqual(accountIngressHeaders({ ...ru, OMOBA_ACCOUNT_INGRESS_KEY: key }), {}, 'a loopback API never receives the key');
  assert.throws(() => assertContour({ ...hosted, VERCEL: '1', OMOBA_ALLOW_INSECURE_LOCAL: '1' }), /refused on Vercel/);
});

test('every Account API behind an ingress needs and gets the key, in every contour and market', () => {
  for (const env of [{ OMOBA_ACCOUNT_API_URL: 'https://api.example' },
    { ...ru, OMOBA_ACCOUNT_API_URL: 'https://account.ru.omoba.io' },
    { ...ru, OMOBA_ACCOUNT_API_URL: 'https://account.ru.omoba.io', OMOBA_TRUST_LOOPBACK_PROXY: undefined }]) {
    for (const value of [undefined, ...bad])
      assert.throws(() => portalConfig({ ...env, OMOBA_ACCOUNT_INGRESS_KEY: value }), /OMOBA_ACCOUNT_INGRESS_KEY/, env.OMOBA_ACCOUNT_API_URL);
    assert.deepEqual(accountIngressHeaders({ ...env, OMOBA_ACCOUNT_INGRESS_KEY: key }), { 'X-Omoba-Portal-Key': key });
  }
  // Guest mode makes no account call and needs no key; a key that is set must still be well formed.
  assert.equal(portalConfig({ OMOBA_ACCOUNT_MODE: 'disabled', OMOBA_ACCOUNT_API_URL: 'https://api.example' }).accountEnabled, false);
  assert.throws(() => portalConfig({ OMOBA_ACCOUNT_MODE: 'disabled', OMOBA_ACCOUNT_INGRESS_KEY: 'secret' }), /64 lowercase hex/);
});

test('the RU production configuration calls the loopback API with the player address', () => {
  assert.equal(assertContour(ru), 'production');
  assert.equal(assertMarket(ru).market, 'ru');
  assert.equal(vkSignInClientId(ru), '51234567');
  assert.deepEqual(portalConfig(ru), { origin: 'https://app.ru.omoba.io', api: 'http://127.0.0.1:40550', secure: true, accountEnabled: true });
  assert.deepEqual(assertPortalConfig(ru), portalConfig(ru));
  assert.deepEqual(accountIngressHeaders(ru), {});
  assert.deepEqual(accountUpstreamHeaders('203.0.113.7', ru), { 'X-Real-IP': '203.0.113.7' });
  assert.deepEqual(accountUpstreamHeaders('2001:db8::7', ru), { 'X-Real-IP': '2001:db8::7' });
  for (const missing of [null, undefined, '', 'unknown', '203.0.113.7, 10.0.0.1', '203.0.113.7:4000'])
    assert.equal(accountUpstreamHeaders(missing, ru), null, String(missing));
  // Without the trust switch every player would share the portal's own address.
  for (const value of [undefined, '', '0'])
    assert.throws(() => assertPortalConfig({ ...ru, OMOBA_TRUST_LOOPBACK_PROXY: value }),
      /OMOBA portal misconfigured, refusing to serve \(fail closed\): .*OMOBA_TRUST_LOOPBACK_PROXY=1/);
  for (const value of ['true', 'yes', '2'])
    assert.throws(() => portalConfig({ ...ru, OMOBA_TRUST_LOOPBACK_PROXY: value }), /OMOBA_TRUST_LOOPBACK_PROXY must be 1 or unset/);
  // Guest mode and explicit local test doubles keep working without it.
  assert.equal(portalConfig({ ...ru, OMOBA_TRUST_LOOPBACK_PROXY: undefined, OMOBA_ACCOUNT_MODE: 'disabled' }).accountEnabled, false);
  assert.equal(portalConfig({ ...ru, OMOBA_TRUST_LOOPBACK_PROXY: undefined, OMOBA_ALLOW_INSECURE_LOCAL: '1' }).accountEnabled, true);
  // A local portal on loopback does not forward an address it does not have.
  assert.deepEqual(accountUpstreamHeaders(null, { OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:40550' }), {});
});

test('the BFF, the VK callback and server reads share one upstream header builder', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const file of ['src/app/api/[...path]/route.ts', 'src/lib/vk-route.ts', 'src/lib/server-api.ts']) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(source, /accountUpstreamHeaders\(/, file);
    assert.ok(!/OMOBA_TRUST_LOOPBACK_PROXY|accountIngressHeaders/.test(source), file + ' builds its own upstream headers');
  }
  const startup = await readFile(new URL('../src/instrumentation.ts', import.meta.url), 'utf8');
  assert.match(startup, /assertPortalConfig\(process\.env\)/, 'the server checks the Account API route at startup');
});
