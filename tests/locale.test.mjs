import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { LOCALE_COOKIE, normalizeLocale, resolveLocale, localeCookie } from '../src/lib/locale.mjs';

test('language negotiation respects manual choice before browser and country', () => {
  assert.equal(resolveLocale({ cookie: 'ru', acceptLanguage: 'zh-CN,en;q=0.8', country: 'CN' }), 'ru');
  assert.equal(resolveLocale({ cookie: 'invalid', acceptLanguage: 'en-US,zh;q=0.8', country: 'CN' }), 'en');
  assert.equal(resolveLocale({ acceptLanguage: 'fr-FR,ru-RU;q=0.6,en;q=0.4', country: 'US' }), 'ru');
  assert.equal(resolveLocale({ acceptLanguage: 'ru;q=0.3,zh-TW;q=0.9,en;q=0.5' }), 'zh');
  assert.equal(resolveLocale({ acceptLanguage: 'en;q=0,ru;q=0.9' }), 'ru');
  assert.equal(resolveLocale({ acceptLanguage: 'ru;q=oops,zh;q=2,en;q=0.5' }), 'en');
});

test('Chinese regions and browser variants share the Chinese website locale', () => {
  for (const value of ['zh', 'zh-CN', 'zh-TW', 'zh-Hant-HK', 'ZH_hans']) assert.equal(normalizeLocale(value), 'zh');
  for (const country of ['CN', 'TW', 'HK', 'MO', 'cn']) assert.equal(resolveLocale({ country }), 'zh');
  assert.equal(resolveLocale({ country: 'RU' }), 'ru');
  assert.equal(resolveLocale({ country: 'US', acceptLanguage: 'fr-FR' }), 'en');
  assert.equal(resolveLocale(), 'en');
});

test('manual preference cookie shares OMOBA subdomains and stays host-only on previews', () => {
  assert.equal(LOCALE_COOKIE, 'omoba_locale');
  for (const hostname of ['omoba.io', 'www.omoba.io', 'app.omoba.io']) {
    const cookie = localeCookie('zh', hostname);
    assert.match(cookie, /Domain=\.omoba\.io/);
    assert.match(cookie, /Path=\/; Max-Age=31536000; SameSite=Lax/);
    assert.match(cookie, /; Secure$/);
  }
  for (const hostname of ['localhost', '127.0.0.1', 'preview.vercel.app', 'omoba.io.evil.example']) {
    assert.doesNotMatch(localeCookie('en', hostname, 'http:'), /Domain=|Secure/);
  }
});

test('account dictionaries and public source translations cover every language', async () => {
  // The production project uses Node 24; strip types without a framework runtime.
  const source = await readFile(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8');
  const javascript = stripTypeScriptTypes(source);
  const { dictionaries, portalTranslations } = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));
  const keys = Object.keys(dictionaries.en).sort();
  assert.deepEqual(Object.keys(dictionaries.ru).sort(), keys);
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), keys);
  for (const key of keys) {
    for (const locale of ['en', 'ru', 'zh']) assert.ok(dictionaries[locale][key].trim(), `${locale}.${key}`);
    assert.match(dictionaries.zh[key], /[\u3400-\u9fff]/u, `Chinese translation missing for ${key}`);
  }
  for (const file of ['portal.tsx', 'devices.tsx', 'supporter.tsx', 'locale-provider.tsx']) {
    const component = await readFile(new URL('../src/components/' + file, import.meta.url), 'utf8');
    for (const match of component.matchAll(/\b(?:t|setMessage|setError)\((['"])([^'"\n]+)\1\)/g)) {
      assert.ok(portalTranslations[match[2]]?.ru, `Missing Russian: ${match[2]}`);
      assert.ok(portalTranslations[match[2]]?.zh, `Missing Chinese: ${match[2]}`);
    }
  }
});
