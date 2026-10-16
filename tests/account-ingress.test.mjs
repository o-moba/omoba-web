import test from 'node:test';
import assert from 'node:assert/strict';
import { accountIngressHeaders, portalConfig } from '../src/lib/security.mjs';
import { assertContour } from '../src/lib/contour-guard.mjs';
const key = 'a'.repeat(64);
const hosted = { NODE_ENV: 'production', OMOBA_CONTOUR: 'dev', OMOBA_PORTAL_ORIGIN: 'https://app.dev.omoba.io',
  OMOBA_ACCOUNT_API_URL: 'https://account.dev.omoba.io', OMOBA_ACCOUNT_MODE: 'enabled', OMOBA_ACCOUNT_INGRESS_KEY: key };
test('hosted dev account access pins the exact origin and requires a bounded ingress key', () => {
  assert.equal(assertContour(hosted), 'dev');
  assert.equal(portalConfig(hosted).api, hosted.OMOBA_ACCOUNT_API_URL);
  assert.deepEqual(accountIngressHeaders(hosted), { 'X-Omoba-Portal-Key': key });
  assert.ok(!JSON.stringify(portalConfig(hosted)).includes(key), 'the public configuration object contains no credential');
  for (const value of ['', 'a'.repeat(63), 'A'.repeat(64), key + '\n', key + '00'])
    assert.throws(() => portalConfig({ ...hosted, OMOBA_ACCOUNT_INGRESS_KEY: value }), /INGRESS_KEY/);
  for (const url of ['https://account.omoba.io', 'https://api.dev.omoba.io', 'https://account.dev.omoba.io.evil.example',
    'https://account.dev.omoba.io:444', 'http://account.dev.omoba.io', 'https://account.dev.omoba.io/path',
    'https://user@account.dev.omoba.io', 'https://account.dev.omoba.io?secret=bad', 'http://127.0.0.1:40550'])
    assert.throws(() => portalConfig({ ...hosted, OMOBA_ACCOUNT_API_URL: url }), url);
  assert.throws(() => portalConfig({ ...hosted, OMOBA_CONTOUR: 'production' }), /dev-contour/);
});
test('ingress key is absent from disabled, production and loopback fixture requests', () => {
  assert.deepEqual(accountIngressHeaders({ ...hosted, OMOBA_ACCOUNT_MODE: 'disabled' }), {});
  assert.deepEqual(accountIngressHeaders({ OMOBA_ACCOUNT_API_URL: 'https://api.example', OMOBA_ACCOUNT_INGRESS_KEY: key }), {});
  assert.deepEqual(accountIngressHeaders({ ...hosted, OMOBA_ALLOW_INSECURE_LOCAL: '1', OMOBA_ACCOUNT_API_URL: 'http://127.0.0.1:40550' }), {});
  assert.throws(() => assertContour({ ...hosted, VERCEL: '1', OMOBA_ALLOW_INSECURE_LOCAL: '1' }), /refused on Vercel/);
});
