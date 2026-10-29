import assert from 'node:assert/strict';
import test from 'node:test';
import { cookieNames } from '../src/lib/security.mjs';
import { MARKET_PRESETS } from '../src/lib/market-profile.mjs';
import { decodeVkCookie, pkceChallenge, vkCallback, vkOneTapStart, VK_ONE_TAP_COOKIE_PREFIX } from '../src/lib/vk-id.mjs';
import { localSignInLocation, oneTapConfiguration, oneTapPayload } from '../src/lib/vk-one-tap-client.mjs';

const origin = 'https://omoba.ru', names = cookieNames(true), features = MARKET_PRESETS.ru;
const start = returnTo => vkOneTapStart({ clientId: '54863720', origin, names, features, returnTo });
function attempt(returnTo = '/me') {
  const result = start(returnTo), cookie = result.cookies.set[0][1];
  return { ...result, cookie, saved: decodeVkCookie(cookie.slice(VK_ONE_TAP_COOKIE_PREFIX.length), features) };
}
async function finish(a, fetch, extra = {}) {
  return vkCallback({ api: 'http://127.0.0.1:40562', origin, names, features, cookie: a.cookie,
    query: new URLSearchParams({ code: 'vk2.code', device_id: 'vk-device', state: a.configuration.state }),
    headers: {}, flow: 'one-tap', fetch, ...extra });
}

test('OneTap receives App ID 54863720 and a public challenge while its verifier stays HttpOnly', () => {
  const a = attempt();
  assert.equal(a.configuration.app, 54863720);
  assert.equal(a.configuration.redirectUrl, origin);
  assert.equal(a.configuration.codeChallenge, pkceChallenge(a.saved.verifier));
  assert.equal(a.configuration.state, a.saved.state);
  assert.equal(a.saved.method, 'vkid');
  assert.equal(a.cookies.set[0][0], '__Host-omoba-vk');
  assert.equal(a.cookies.set[0][2], 600);
  assert.equal(JSON.stringify(a.configuration).includes(a.saved.verifier), false);
  assert.equal(decodeVkCookie(a.cookie, features), null, 'widget cookie cannot be used in redirect callback');
});

test('widget completion exchanges server-side at the registered root and creates a normal session', async () => {
  const a = attempt();
  let calls = 0;
  const result = await finish(a, async (url, init) => {
    calls++;
    assert.equal(url, 'http://127.0.0.1:40562/v1/auth/social/vk');
    const body = JSON.parse(init.body);
    assert.equal(body.redirect_uri, origin);
    assert.equal(body.code_verifier, a.saved.verifier);
    assert.equal(body.state, a.configuration.state);
    assert.equal(body.register, true);
    return Response.json({ state: 'signed_in', session_token: 'a'.repeat(64) });
  });
  assert.equal(calls, 1);
  assert.equal(result.location, '/me');
  assert.deepEqual(result.cookies.set, [[names.session, 'a'.repeat(64), 604800]]);
  assert.ok(result.cookies.clear.includes(names.vk));
  assert.ok(result.cookies.clear.includes(names.csrf));
});

test('game enrollment retains the native profile linking path instead of registering a blank profile', async () => {
  const a = attempt('/connect?code=ABCD2345');
  const result = await finish(a, async (_url, init) => {
    assert.equal('register' in JSON.parse(init.body), false);
    return Response.json({ state: 'unlinked', social_ticket: 'c'.repeat(64) });
  });
  assert.equal(result.location, '/connect?code=ABCD2345');
  assert.equal(result.cookies.set[0][0], names.social);
  assert.ok(result.cookies.clear.includes(names.session));
});

test('foreign state, missing/replayed cookie and mixed redirect flows never reach the API', async () => {
  const a = attempt(), fetch = async () => assert.fail('must not call API');
  for (const extra of [
    { cookie: undefined }, { cookie: a.cookie.slice(VK_ONE_TAP_COOKIE_PREFIX.length) },
    { flow: 'redirect' }, { query: new URLSearchParams({ state: 'f'.repeat(64), code: 'code', device_id: 'd' }) },
  ]) assert.match((await finish(a, fetch, extra)).location, /^\/login\?signin=failed/);
});

test('SDK configuration and success payloads are whitelisted and bound to the current attempt', () => {
  const a = attempt(), config = oneTapConfiguration(a.configuration, origin);
  assert.deepEqual(config, a.configuration);
  assert.equal('codeVerifier' in config, false);
  for (const value of [{ ...config, redirectUrl: 'https://evil.example' }, { ...config, state: 'x' }, { ...config, codeChallenge: 'short' }, { ...config, app: NaN }])
    assert.throws(() => oneTapConfiguration(value, origin));
  const payload = { code: 'vk2.code', device_id: 'device-1', state: config.state };
  assert.deepEqual(oneTapPayload({ ...payload, access_token: 'never-forward-me', user_id: '1' }, config.state), payload);
  for (const value of [{ ...payload, state: 'foreign' }, { ...payload, code: '' }, { ...payload, device_id: 'has space' }, { access_token: 'forged' }])
    assert.throws(() => oneTapPayload(value, config.state));
});

test('a callback destination remains local and respects the server-selected route', () => {
  assert.equal(localSignInLocation('/connect?code=ABCD2345', origin), '/connect?code=ABCD2345');
  assert.equal(localSignInLocation('/login?signin=failed', origin), '/login?signin=failed');
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/me\n'])
    assert.throws(() => localSignInLocation(value, origin));
});
