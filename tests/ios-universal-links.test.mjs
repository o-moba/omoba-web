import assert from 'node:assert/strict';
import test from 'node:test';
import { IOS_LINKS, iosAssociationResponse, iosReturnUrl, canOfferIosReturn } from '../src/lib/ios-universal-links.mjs';

test('only the exact dedicated host serves the RU association, without redirects or cookies', async () => {
  for (const contour of ['production', 'dev']) {
    const env = { OMOBA_MARKET: 'ru', OMOBA_CONTOUR: contour };
    const config = IOS_LINKS[contour];
    const request = new Request('https://' + config.host + '/.well-known/apple-app-site-association');
    const response = iosAssociationResponse(request, env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), { applinks: { details: [{ appIDs: [config.appID], components: [{ '/': '/auth' }] }] } });
    const head = iosAssociationResponse(new Request(request.url, { method: 'HEAD' }), env);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
});

test('a different contour, market, ordinary site or foreign host never claims the app', async () => {
  for (const [host, env] of [
    ['ios.dev.omoba.io', { OMOBA_MARKET: 'ru' }],
    ['ios.omoba.ru', { OMOBA_MARKET: 'ru', OMOBA_CONTOUR: 'dev' }],
    ['ios.omoba.ru', { OMOBA_MARKET: 'global' }],
    ['ios.omoba.ru', { OMOBA_MARKET: 'cn' }],
    ['omoba.ru', { OMOBA_MARKET: 'ru' }],
    ['ios.omoba.ru.evil.example', { OMOBA_MARKET: 'ru' }],
    ['127.0.0.1', { OMOBA_MARKET: 'ru' }],
  ]) {
    assert.equal(iosAssociationResponse(new Request('https://' + host + '/.well-known/apple-app-site-association'), env).status, 404);
  }
});

test('the local production HTTP smoke needs an explicit loopback override', () => {
  const request = new Request('http://127.0.0.1:3022/.well-known/apple-app-site-association');
  assert.equal(iosAssociationResponse(request, { OMOBA_MARKET: 'ru', OMOBA_ALLOW_INSECURE_LOCAL: '1' }).status, 200);
});

test('a loopback reverse-proxy listener cannot bypass the public Host boundary', () => {
  const env = { OMOBA_MARKET: 'ru', OMOBA_ALLOW_INSECURE_LOCAL: '1' };
  for (const host of ['omoba.ru', 'evil.example', 'ios.dev.omoba.io']) {
    const request = new Request('http://127.0.0.1:3022/.well-known/apple-app-site-association', { headers: { Host: host, 'X-Forwarded-Host': 'ios.omoba.ru' } });
    assert.equal(iosAssociationResponse(request, env).status, 404);
  }
  assert.equal(iosAssociationResponse(new Request('http://127.0.0.1:3022/.well-known/apple-app-site-association', { headers: { Host: 'ios.omoba.ru' } }), env).status, 200);
});

test('the return link contains no login code, token, identity or open redirect', () => {
  assert.equal(iosReturnUrl(), 'https://ios.omoba.ru/auth');
  assert.equal(iosReturnUrl('dev'), 'https://ios.dev.omoba.io/auth');
  assert.throws(() => iosReturnUrl('other'));
});

test('offer return only on Apple mobile after a successful confirmation', () => {
  assert.equal(canOfferIosReturn('ru', 'approved', 'iPhone'), true);
  assert.equal(canOfferIosReturn('ru', 'attached', 'iPad'), true);
  assert.equal(canOfferIosReturn('ru', 'approved', 'Macintosh', 'MacIntel', 5), true);
  for (const phase of ['idle', 'checking', 'review', 'error', 'expired', 'fresh', 'conflict'])
    assert.equal(canOfferIosReturn('ru', phase, 'iPhone'), false);
  assert.equal(canOfferIosReturn('ru', 'approved', 'Android'), false);
  assert.equal(canOfferIosReturn('global', 'approved', 'iPhone'), false);
  assert.equal(canOfferIosReturn('ru', 'approved', 'Macintosh', 'MacIntel', 0), false);
});
