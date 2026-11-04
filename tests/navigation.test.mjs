import test from 'node:test';
import assert from 'node:assert/strict';
import { portalReturnTo, portalLoginHref, portalShellRoute, publicSiteUrl } from '../src/lib/navigation.mjs';

test('sign-in preserves history filters, report IDs and workshop destinations', () => {
  for (const path of ['/me/matches?days=all&class=Ranger', '/matches/browser-fixture-123', '/workshop', '/me/stats', '/supporter', '/supporters', '/sponsor']) {
    assert.equal(portalReturnTo(path), path);
    assert.equal(new URL(portalLoginHref(path), 'https://app.omoba.io').searchParams.get('returnTo'), path);
  }
});
test('sign-in return destinations cannot escape the app or loop through login', () => {
  for (const path of [undefined, '//evil.example', 'https://evil.example', '/\\evil.example', '/login', '/api/me', '/%2f%2fevil.example', '/me\n', '/me#fragment', '/' + 'x'.repeat(3000)]) assert.equal(portalReturnTo(path), '/me');
});
test('back-to-site link accepts explicit local development only and no credential URLs', () => {
  assert.equal(publicSiteUrl(undefined, 'production'), 'https://omoba.io');
  assert.equal(publicSiteUrl('http://127.0.0.1:3102', 'development'), 'http://127.0.0.1:3102');
  for (const value of ['http://127.0.0.1:3102', 'http://remote.example', 'https://u:p@site.example', 'https://site.example/path', 'javascript:alert(1)']) assert.equal(publicSiteUrl(value, 'production'), 'https://omoba.io');
});

test('the portal shell serves only its own pages; anything else is a real 404', () => {
  for (const path of ['/me', '/me/matches', '/me/stats', '/friends', '/players', '/devices', '/settings', '/download', '/connect', '/login', '/supporter', '/supporters',
    '/matches/0123abcdef', '/players/' + 'a'.repeat(64)]) assert.equal(portalShellRoute(path), true, path);
  for (const path of ['/zzz', '/contacts', '/me/zzz', '/matches', '/matches/a/b', '/players/', '/download/ru', '/game/x', '/me/', '/matches/' + 'x'.repeat(129), '/players/a%2fb'])
    assert.equal(portalShellRoute(path), false, path);
});
