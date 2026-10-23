import test from 'node:test';
import assert from 'node:assert/strict';
import nextCookies from 'next/dist/compiled/@edge-runtime/cookies/index.js';
import {
  SIGNIN_FAILURES, VK_METHODS, applyCookies, decodeVkCookie, encodeVkCookie, newVkAttempt, pkceChallenge,
  vkAuthorizeUrl, vkCallback, vkFailureLocation, vkRedirectUri, vkStart,
} from '../src/lib/vk-id.mjs';
import { cookieNames, socialTicketBody } from '../src/lib/security.mjs';

const ORIGIN = 'https://app.ru.omoba.example';
const API = 'https://account.ru.omoba.example';
const RU = { ekza: false, supporter: false, vkSignIn: true };
const NAMES = cookieNames(true);
const TOKEN = 'b'.repeat(64), TICKET = 'c'.repeat(64);
/** Deterministic "random" bytes: 0xa1 0xa2 … per call. */
const counter = () => { let n = 0; return (size) => Buffer.alloc(size, 0xa0 + ++n); };

function start(overrides = {}) {
  return vkStart({ clientId: '54321', origin: ORIGIN, names: NAMES, features: RU, method: 'vkid', returnTo: null, random: counter(), ...overrides });
}
/** A stubbed Account API that records what the portal sent. */
function api(status, body, { raw } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    return new Response(raw ?? JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, calls };
}
function attempt(returnTo = '/connect?code=ABCD2345', method = 'ok_ru') {
  const { state, verifier } = newVkAttempt(counter());
  return { state, verifier, method, returnTo, cookie: encodeVkCookie({ state, verifier, method, returnTo }) };
}
function callback(a, query, fetch, extra = {}) {
  return vkCallback({ api: API, origin: ORIGIN, names: NAMES, features: RU, query: new URLSearchParams(query), cookie: a?.cookie, headers: { 'X-Omoba-Portal-Key': 'k'.repeat(64) }, fetch, now: Date.parse('2026-10-23T10:00:00Z'), ...extra });
}
function setCookieLines(changes, secure = true) {
  const headers = new Headers();
  applyCookies(new nextCookies.ResponseCookies(headers), changes, secure);
  return headers.getSetCookie();
}

test('PKCE S256 matches the RFC 7636 example and attempts are long random secrets', () => {
  // RFC 7636, Appendix B.
  assert.equal(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const { state, verifier } = newVkAttempt();
  assert.match(state, /^[0-9a-f]{64}$/);
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(newVkAttempt().state, state);
  assert.deepEqual([...VK_METHODS], ['vkid', 'ok_ru', 'mail_ru']);
});

test('start redirects to VK ID with exactly the OAuth 2.1 + PKCE parameters', () => {
  for (const method of VK_METHODS) {
    const result = start({ method });
    assert.ok('location' in result);
    const url = new URL(result.location);
    assert.equal(url.origin + url.pathname, 'https://id.vk.ru/authorize');
    const params = Object.fromEntries(url.searchParams);
    const [[name, value, maxAge]] = result.cookies.set;
    const saved = decodeVkCookie(value, RU);
    assert.deepEqual(params, {
      response_type: 'code', client_id: '54321', redirect_uri: ORIGIN + '/api/auth/vk/callback', state: saved.state,
      code_challenge: pkceChallenge(saved.verifier), code_challenge_method: 'S256', scope: 'vkid.personal_info', provider: method,
    });
    assert.equal(name, '__Host-omoba-vk');
    assert.equal(maxAge, 600);
    assert.equal(saved.method, method);
    assert.equal(saved.returnTo, '/me');
    // The verifier never leaves the cookie; only its challenge goes to VK.
    assert.doesNotMatch(result.location, new RegExp(saved.verifier));
  }
  assert.equal(vkRedirectUri('https://app.omoba.io'), 'https://app.omoba.io/api/auth/vk/callback');
  assert.equal(new URL(vkAuthorizeUrl({ clientId: '1', redirectUri: 'x', state: 's', verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', method: 'mail_ru' })).searchParams.get('code_challenge'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('start refuses unknown methods and keeps only allowlisted return destinations', () => {
  for (const method of [null, '', 'vk', 'google', 'VKID', 'ok_ru ']) assert.deepEqual(start({ method }), { code: 'invalid_method', status: 400 });
  const returnTo = (value) => decodeVkCookie(start({ returnTo: value }).cookies.set[0][1], RU).returnTo;
  assert.equal(returnTo('/connect?code=ABCD2345'), '/connect?code=ABCD2345');
  assert.equal(returnTo('/workshop'), '/workshop');
  for (const bad of ['https://evil.example', '//evil.example', '/market', '/supporter', '/connect?code=bad', '/api/me', '/login'])
    assert.equal(returnTo(bad), '/me', bad);
});

test('the attempt cookie is HttpOnly, Lax, Path=/, 600 s, Secure and __Host- on HTTPS', () => {
  const secure = start().cookies;
  const [line] = setCookieLines(secure, true);
  const attributes = line.split('; ');
  assert.match(attributes[0], /^__Host-omoba-vk=[0-9a-f]{64}\.[A-Za-z0-9_-]{43}\.vkid\.[A-Za-z0-9_-]+$/);
  for (const required of ['Path=/', 'Max-Age=600', 'HttpOnly', 'SameSite=lax', 'Secure']) assert.ok(attributes.includes(required), required + ': ' + line);
  assert.equal(attributes.some(a => a.startsWith('Domain=')), false);
  const local = vkStart({ clientId: '1', origin: 'http://127.0.0.1:3010', names: cookieNames(false), features: RU, method: 'vkid', returnTo: null });
  const [plain] = setCookieLines(local.cookies, false);
  assert.match(plain, /^omoba-vk=/);
  assert.equal(plain.split('; ').includes('Secure'), false);
});

test('a tampered attempt cookie is refused', () => {
  const a = attempt();
  assert.ok(decodeVkCookie(a.cookie, RU));
  const [state, verifier, method, returnTo] = a.cookie.split('.');
  for (const bad of [undefined, '', 'x', [state.slice(1), verifier, method, returnTo], [state, 'short', method, returnTo], [state, verifier, 'google', returnTo],
    [state, verifier, method, Buffer.from('//evil.example').toString('base64url')], [state, verifier, method, Buffer.from('/market').toString('base64url')], [state, verifier, method, returnTo, 'extra']])
    assert.equal(decodeVkCookie(Array.isArray(bad) ? bad.join('.') : bad, RU), null, String(bad));
});

test('callback refuses a missing attempt, a foreign state and VK errors without calling the API', async () => {
  const a = attempt();
  const stub = api(200, { state: 'signed_in', session_token: TOKEN });
  const query = { code: 'vk2.a.code', state: a.state, device_id: 'device-1', type: 'code_v2', ext_id: 'x' };
  const none = await callback(undefined, query, stub.fetch);
  assert.deepEqual(none, { location: '/login?signin=failed', cookies: { set: [], clear: [] } });
  for (const state of [undefined, '', 'f'.repeat(64), a.state.toUpperCase(), a.state + '0']) {
    const result = await callback(a, { ...query, state }, stub.fetch);
    assert.deepEqual(result, { location: '/login?signin=failed&returnTo=%2Fconnect%3Fcode%3DABCD2345', cookies: { set: [], clear: [NAMES.vk] } }, String(state));
  }
  assert.equal((await callback(a, { error: 'access_denied', error_description: 'User denied', state: a.state }, stub.fetch)).location, '/login?signin=cancelled&returnTo=%2Fconnect%3Fcode%3DABCD2345');
  assert.equal((await callback(a, { error: 'server_error', state: a.state }, stub.fetch)).location, '/login?signin=failed&returnTo=%2Fconnect%3Fcode%3DABCD2345');
  for (const missing of ['code', 'device_id']) {
    const { [missing]: _, ...rest } = query;
    assert.match((await callback(a, rest, stub.fetch)).location, /signin=failed/);
  }
  assert.match((await callback(a, { ...query, code: 'has space' }, stub.fetch)).location, /signin=failed/);
  assert.equal(stub.calls.length, 0);
});

test('callback forwards exactly what the Account API needs and signs in like pairing complete', async () => {
  const a = attempt();
  const stub = api(200, { state: 'signed_in', session_token: TOKEN, profile: { profile_id: 'p'.repeat(64), nickname: 'Ivan#1234' } });
  const result = await callback(a, { code: 'vk2.a.code-123', state: a.state, device_id: 'dev_ABC-1', type: 'code_v2' }, stub.fetch);
  assert.equal(stub.calls.length, 1);
  const [{ url, init, body }] = stub.calls;
  assert.equal(url, API + '/v1/auth/social/vk');
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'error');
  assert.equal(init.cache, 'no-store');
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(init.headers, { 'X-Omoba-Portal-Key': 'k'.repeat(64), 'Content-Type': 'application/json' });
  assert.deepEqual(body, { method: 'ok_ru', code: 'vk2.a.code-123', code_verifier: a.verifier, device_id: 'dev_ABC-1', redirect_uri: ORIGIN + '/api/auth/vk/callback', state: a.state });
  assert.deepEqual(result, {
    location: '/connect?code=ABCD2345',
    cookies: { set: [[NAMES.session, TOKEN, 7 * 86400]], clear: [NAMES.vk, NAMES.pair, NAMES.csrf, NAMES.social] },
  });
  const lines = setCookieLines(result.cookies);
  const session = lines.find(line => line.startsWith('__Host-omoba-session=' + TOKEN));
  for (const required of ['Path=/', 'Max-Age=604800', 'HttpOnly', 'SameSite=lax', 'Secure']) assert.ok(session.split('; ').includes(required), required);
  for (const name of [NAMES.vk, NAMES.pair, NAMES.csrf, NAMES.social]) assert.ok(lines.some(line => line.startsWith(name + '=;') && line.includes('Max-Age=0') && line.includes('Secure')), name);
});

test('an unlinked VK ID leaves only an HttpOnly ticket, bounded by its expiry', async () => {
  const a = attempt('/me', 'vkid');
  const stub = api(200, { state: 'unlinked', social_ticket: TICKET, display_name: 'Иван П.', expires_at: '2026-10-23T10:10:00Z' });
  const result = await callback(a, { code: 'c', state: a.state, device_id: 'd' }, stub.fetch);
  assert.deepEqual(result, { location: '/me', cookies: { set: [[NAMES.social, TICKET, 600]], clear: [NAMES.vk] } });
  const [, ticket] = setCookieLines(result.cookies);
  const attributes = ticket.split('; ');
  assert.equal(attributes[0], '__Host-omoba-social=' + TICKET);
  for (const required of ['Path=/', 'Max-Age=600', 'HttpOnly', 'SameSite=lax', 'Secure']) assert.ok(attributes.includes(required), required);
  // No expiry, or one beyond 30 minutes, stays at the 30-minute ceiling.
  const later = api(200, { state: 'unlinked', social_ticket: TICKET, expires_at: '2026-10-24T00:00:00Z' });
  assert.equal((await callback(a, { code: 'c', state: a.state, device_id: 'd' }, later.fetch)).cookies.set[0][2], 1800);
  // The display name is never put into a cookie or URL by the callback.
  assert.doesNotMatch(JSON.stringify(result), /Иван/);
});

test('Account API errors become friendly sign-in messages; malformed replies set nothing', async () => {
  const a = attempt('/me');
  const query = { code: 'c', state: a.state, device_id: 'd' };
  for (const [status, body, reason] of [
    [404, { code: 'not_found' }, 'unavailable'], [400, { code: 'invalid_request' }, 'failed'], [502, { code: 'provider_rejected' }, 'rejected'],
    [503, { code: 'provider_unavailable' }, 'provider_unavailable'], [409, { code: 'session_limit' }, 'session_limit'], [429, { code: 'rate_limited' }, 'rate_limited'],
    [500, { code: 'internal' }, 'unavailable'], [503, { code: 'account_service_unavailable' }, 'unavailable'],
    [200, { state: 'signed_in', session_token: 'short' }, 'unavailable'], [200, { state: 'unlinked', social_ticket: 'Z'.repeat(64) }, 'unavailable'],
    [200, { state: 'other' }, 'unavailable'], [200, [], 'unavailable'],
  ]) {
    const result = await callback(a, query, api(status, body).fetch);
    assert.deepEqual(result, { location: '/login?signin=' + reason, cookies: { set: [], clear: [NAMES.vk] } }, status + ' ' + JSON.stringify(body));
    assert.ok(SIGNIN_FAILURES.includes(reason));
  }
  assert.equal((await callback(a, query, api(200, null, { raw: 'not json' }).fetch)).location, '/login?signin=unavailable');
  assert.equal((await callback(a, query, async () => { throw new TypeError('fetch failed'); })).location, '/login?signin=unavailable');
  assert.equal(vkFailureLocation('<script>', '/me'), '/login?signin=failed');
});

test('VK ID ticket routes inject the ticket from its cookie and never trust the browser body', () => {
  assert.deepEqual(socialTicketBody('auth/social/attach', { code: 'ABCD2345' }, TICKET), { body: { code: 'ABCD2345', social_ticket: TICKET } });
  assert.deepEqual(socialTicketBody('auth/social/ticket', {}, TICKET), { body: { social_ticket: TICKET } });
  assert.deepEqual(socialTicketBody('auth/social/ticket', undefined, TICKET), { body: { social_ticket: TICKET } });
  // A browser-supplied ticket (or anything else) is refused, not merged.
  for (const body of [{ code: 'ABCD2345', social_ticket: 'd'.repeat(64) }, { social_ticket: 'd'.repeat(64) }, { code: 'abcd2345' }, { code: 'ABCD1345' }, { code: 12345678 }, {}, { code: 'ABCD2345', extra: 1 }])
    assert.deepEqual(socialTicketBody('auth/social/attach', body, TICKET), { code: 'invalid_request', status: 400 }, JSON.stringify(body));
  assert.deepEqual(socialTicketBody('auth/social/ticket', { social_ticket: 'd'.repeat(64) }, TICKET), { code: 'invalid_request', status: 400 });
  for (const cookie of [undefined, '', 'C'.repeat(64), TICKET + '0', 'c'.repeat(63)])
    assert.deepEqual(socialTicketBody('auth/social/attach', { code: 'ABCD2345' }, cookie), { code: 'social_ticket_expired', status: 404 }, String(cookie));
  assert.deepEqual(cookieNames(true), { session: '__Host-omoba-session', pair: '__Host-omoba-pair', csrf: '__Host-omoba-csrf', vk: '__Host-omoba-vk', social: '__Host-omoba-social' });
  assert.equal(cookieNames(false).social, 'omoba-social');
});
