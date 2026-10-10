import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../src/lib/creator-translations.ts', import.meta.url), 'utf8');
const javascript = stripTypeScriptTypes(source);
const { creatorTranslations, creatorText } = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));
const assets = JSON.parse(await readFile(new URL('../public/asset-catalog/catalog.json', import.meta.url), 'utf8'));
const workshop = JSON.parse(await readFile(new URL('../public/workshop/catalog.json', import.meta.url), 'utf8'));

test('creator and workshop copy has Russian and Chinese with matching placeholders', () => {
  const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [english, translations] of Object.entries(creatorTranslations)) {
    for (const locale of ['ru', 'zh']) {
      assert.ok(translations[locale]?.trim(), `${locale}: ${english}`);
      assert.deepEqual(parameters(translations[locale]), parameters(english), `${locale} placeholders: ${english}`);
    }
  }
});

test('all published game descriptions and reference labels are localized without changing canonical data', () => {
  const originalAssets = JSON.stringify(assets);
  const originalWorkshop = JSON.stringify(workshop);
  const copy = new Set([
    ...assets.classes.flatMap(row => [row.name, row.description, row.basicAttack.name]),
    ...assets.skills.flatMap(row => [row.name, row.description]),
    ...assets.requirements.flatMap(row => [row.name, row.brief]),
    ...workshop.cores.flatMap(row => [row.name, row.description]),
    ...workshop.skills.flatMap(row => [row.name, row.description]),
    ...workshop.passives.map(row => row.name),
  ]);
  for (const text of copy) {
    assert.equal(creatorText('en', text), text);
    assert.notEqual(creatorText('ru', text), text, `Russian: ${text}`);
    assert.match(creatorText('zh', text), /[\u3400-\u9fff]/u, `Chinese: ${text}`);
  }
  assert.equal(JSON.stringify(assets), originalAssets);
  assert.equal(JSON.stringify(workshop), originalWorkshop);
});

test('dynamic labels preserve user-authored names and export identifiers', () => {
  const name = 'Мой билд · 中文 · keep English';
  assert.equal(creatorText('zh', 'Load account build {name}', { name }), `加载账号配置 ${name}`);
  assert.equal(creatorText('ru', 'Delete account build {name}', { name }), `Удалить сборку аккаунта ${name}`);
  assert.equal(creatorText('zh', 'omoba.class-build.v1'), 'omoba.class-build.v1');
  assert.equal(creatorText('ru', 'dawnweaver'), 'dawnweaver');
});

test('validation and existing feedback can change language after they are produced', () => {
  const messages = [
    'Each skill can be assigned only once.',
    'Switchfire requires a ranged core attack profile.',
    'Build name must contain 1–80 characters without control characters.',
    'Loaded account build version 12. Your browser recovery draft will follow this editor.',
    'Skill unknown_skill is not composable in this catalogue.',
  ];
  for (const message of messages) {
    assert.notEqual(creatorText('ru', message), message);
    assert.match(creatorText('zh', message), /[\u3400-\u9fff]/u);
    assert.equal(creatorText('en', message), message);
  }
  assert.match(creatorText('zh', messages.at(-1)), /unknown_skill/);
  assert.match(creatorText('ru', messages[3]), /12/);
});
