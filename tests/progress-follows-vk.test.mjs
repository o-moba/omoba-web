// LR-18: where the market signs in with VK ID, the portal says that progress follows
// the VK-linked account, on the guest home, sign-in, /connect and Devices. The RU
// browser run is tests/vk-sign-in.e2e.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = (file) => readFile(new URL('../src/' + file, import.meta.url), 'utf8');
const between = (text, start, end) => {
  const from = text.indexOf(start);
  assert.notEqual(from, -1, start);
  const to = text.indexOf(end, from + start.length);
  assert.notEqual(to, -1, end);
  return text.slice(from, to);
};

test('the progress note shows only with VK ID sign-in and is translated', async () => {
  const note = between(await source('components/social.tsx'), 'export function ProgressFollowsVk', '\n}\n');
  assert.match(note, /if \(!features\.vkSignIn\) return null;/);
  const english = note.match(/\bt\('([^']+)'\)/)?.[1];
  assert.ok(english, 'one translated sentence');
  assert.match(english, /^Progress follows the VK-linked account\./);
  assert.match(english, /reinstall/);
  assert.match(english, /new device/);
  assert.match(english, /same VK ID/);
  assert.match(english, /Recovery codes work on any device/);
  const { portalTranslations } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(await source('lib/i18n.ts'))).toString('base64'));
  const { ru, zh } = portalTranslations[english];
  assert.match(ru, /^Прогресс следует за аккаунтом, привязанным к VK\./);
  assert.match(ru, /переустановки/);
  assert.match(ru, /тем же VK ID/);
  assert.match(ru, /Коды восстановления/);
  assert.match(zh, /VK ID/);
  assert.match(zh, /恢复码/);
});

test('guest home, sign-in, /connect and Devices carry the note', async () => {
  const portal = await source('components/portal.tsx');
  assert.match(between(portal, 'else if(!account)content=', '\n'), /<ProgressFollowsVk\/>/, 'guest home');
  assert.match(between(portal, 'function Login(', 'function FilterBar('), /<VkSignInButtons returnTo=\{returnTo\}\/><ProgressFollowsVk\/>/, 'sign-in');
  assert.match(between(await source('components/connect.tsx'), 'const signIn = <>', '</>;'), /<ProgressFollowsVk \/>/, '/connect sign-in step');
  assert.match(between(await source('components/devices.tsx'), '{t("Account recovery")}', '</section>'), /<ProgressFollowsVk \/>/, 'Devices → Account recovery');
});
