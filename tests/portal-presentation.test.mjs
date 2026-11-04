import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_CLASSES, resultTone, playerResult, teamSummaries, recordRate, meterPercent, ratingBounds, classArtwork, classDisplayName, teamDisplayName, presentationWords, unratedReason } from '../src/lib/portal-presentation.mjs';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

async function importTs(path) {
  const source = stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'));
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

const participant = (profile_id, team, kills = 0) => ({ profile_id, team, stats: { kills, deaths: 2, assists: 3, damage_to_heroes: 150, structures_destroyed: 1 } });
const match = { outcome: 'completed', winner: 'blue', participants: [participant('me', 'blue', 4), participant('other', 'red', 2), participant(null, 'blue', 6)] };

test('completed wins and losses are explicit; interrupted, abandoned and unknown results stay neutral', () => {
  assert.equal(resultTone(true, 'completed'), 'won');
  assert.equal(resultTone(false, 'completed'), 'lost');
  for (const state of ['interrupted', 'abandoned', 'unknown']) assert.equal(resultTone(true, state), 'neutral');
  assert.equal(resultTone(null, 'completed'), 'neutral');
});

test('a missing player or a match without an authoritative winner never becomes a defeat', () => {
  assert.equal(playerResult(match, 'me'), true);
  assert.equal(playerResult(match, 'other'), false);
  assert.equal(playerResult(match, 'absent'), null);
  assert.equal(playerResult({ ...match, winner: null }, 'me'), null);
  assert.equal(playerResult({ ...match, outcome: 'interrupted' }, 'me'), null);
  assert.equal(playerResult({ ...match, winner: 'missing-team' }, 'me'), null);
});

test('team summaries aggregate participants including bots without inventing a winner', () => {
  const teams = teamSummaries(match);
  assert.deepEqual(teams.map(({ id, kills, deaths, assists, damage, structures, result }) => ({ id, kills, deaths, assists, damage, structures, result })), [
    { id: 'blue', kills: 10, deaths: 4, assists: 6, damage: 300, structures: 2, result: 'won' },
    { id: 'red', kills: 2, deaths: 2, assists: 3, damage: 150, structures: 1, result: 'lost' },
  ]);
  assert.ok(teamSummaries({ ...match, winner: null }).every(team => team.result === 'neutral'));
  assert.ok(teamSummaries({ ...match, outcome: 'abandoned' }).every(team => team.result === 'neutral'));
  assert.ok(teamSummaries({ ...match, winner: 'not-a-team' }).every(team => team.result === 'neutral'));
  assert.deepEqual(teamSummaries({ ...match, participants: [] }), []);
});

test('zero and missing samples remain distinct in record and meter presentation', () => {
  assert.equal(recordRate(0, 4), 0);
  assert.equal(recordRate(3, 1), .75);
  assert.equal(recordRate(0, 0), null);
  assert.equal(recordRate(undefined, 1), null);
  assert.equal(recordRate(-1, 2), null);
  assert.equal(meterPercent(null), null);
  assert.equal(meterPercent(0), 0);
  assert.equal(meterPercent(1.5), 100);
});

test('chart bounds follow actual rating values and support one match or no history', () => {
  assert.equal(ratingBounds([]), null);
  assert.deepEqual(ratingBounds([{ before: 40, after: 40 }]), { min: 20, max: 60 });
  const bounds = ratingBounds([{ before: 1100, after: 1120 }, { before: 1120, after: 1110 }]);
  assert.ok(bounds.min < 1100 && bounds.max > 1120);
});

test('class artwork is allowlisted and new copy is complete in every supported language', () => {
  assert.equal(classArtwork('Warrior'), '/art/portal/classes/warrior.png');
  assert.equal(classArtwork('../../secret'), null);
  assert.equal(classArtwork('constructor'), null);
  assert.equal(classDisplayName('mage'), 'Mage');
  assert.equal(classDisplayName('Mage', 'ru'), 'Маг');
  assert.equal(classDisplayName('riftshot', 'zh'), '裂隙射手');
  assert.equal(classDisplayName('warden', 'xx'), 'Warden');
  assert.equal(classDisplayName('future_class'), 'future_class');
  assert.equal(classDisplayName('future_class', 'ru'), 'future_class');
  assert.equal(teamDisplayName('green', 'en'), 'Green');
  assert.equal(teamDisplayName('blue', 'ru'), 'синих');
  assert.equal(teamDisplayName('future-team', 'ru'), 'future-team');
  for (const locale of ['en', 'ru', 'zh']) assert.deepEqual(Object.keys(presentationWords(locale)), Object.keys(presentationWords('en')));
});

test('the class list is the game\'s seventeen classes, named in every language; four have portraits', async () => {
  const ids = HERO_CLASSES.map(hero => hero.id);
  assert.equal(ids.length, 17);
  assert.deepEqual(ids.slice(0, 4), ['warrior', 'mage', 'ranger', 'cleric']);
  assert.equal(new Set(ids).size, ids.length);
  for (const hero of HERO_CLASSES) {
    assert.match(hero.id, /^[a-z]+$/);
    assert.ok(hero.en && hero.ru && hero.zh, hero.id);
    assert.match(hero.ru, /^[А-Яа-яЁё ]+$/u, hero.id);
    assert.match(hero.zh, /^[㐀-鿿]+$/u, hero.id);
  }
  // The portal's catalog snapshot (exported from the game's shared/assets/catalog) knows the same classes.
  const catalog = JSON.parse(await readFile(new URL('../public/asset-catalog/catalog.json', import.meta.url), 'utf8'));
  assert.deepEqual([...ids].sort(), catalog.classes.map(c => c.id).sort());
  assert.deepEqual(ids.filter(id => classArtwork(id)), ['warrior', 'mage', 'ranger', 'cleric']);
  // Optional cross-check against the game: OMOBA_GAME_HERO_I18N=<omoba-bevy>/client/i18n.
  if (process.env.OMOBA_GAME_HERO_I18N) {
    for (const [locale, folder] of [['en', 'en'], ['ru', 'ru'], ['zh', 'zh-Hans']]) {
      const names = JSON.parse(await readFile(process.env.OMOBA_GAME_HERO_I18N + '/' + folder + '/hero.json', 'utf8'));
      for (const hero of HERO_CLASSES) assert.equal(hero[locale], names['hero.' + hero.id + '.name'], hero.id + ' ' + locale);
    }
  }
});

test('unrated reasons become sentences in every language and a raw code never reaches the page', async () => {
  const { dictionaries } = await importTs('../src/lib/i18n.ts');
  for (const [locale, words] of Object.entries(dictionaries)) {
    const seen = new Set();
    for (const code of ['casual_queue', 'allocated_bots', 'server_interrupted', 'not_completed', 'future_code', null, undefined]) {
      const text = unratedReason(code, words);
      assert.ok(text && !text.includes('_'), locale + ' ' + code);
      seen.add(text);
    }
    assert.equal(seen.size, 5, locale);
    assert.equal(unratedReason('future_code', words), words.unratedOther);
  }
  assert.equal(unratedReason('casual_queue', dictionaries.ru), 'Матчи в обычном PvP не влияют на рейтинг.');
  assert.equal(unratedReason('allocated_bots', dictionaries.en), 'Bots filled open seats, so this match is unrated.');
  // The new copy (leaderboard, newcomer line, singular tags, experience) exists in ru, en and zh.
  for (const key of ['xp', 'ratedOne', 'unratedOne', 'newcomerProgress', 'newcomerHelp', 'leaderboard', 'leaderboardIntro', 'yourPlace', 'leaderboardNewcomer', 'leaderboardHidden', 'leaderboardEmpty', 'rank', 'player', 'winsLosses', 'listedOnLeaderboard', 'listedHelp'])
    for (const [locale, words] of Object.entries(dictionaries)) assert.ok(typeof words[key] === 'string' && words[key].trim(), locale + '.' + key);
  for (const key of ['newcomerProgress', 'newcomerHelp', 'leaderboardIntro', 'leaderboardNewcomer', 'leaderboardEmpty'])
    for (const words of Object.values(dictionaries)) assert.match(words[key], /\{total\}/, key);
  assert.equal(dictionaries.ru.ratedOne, 'Рейтинговый');
  assert.equal(dictionaries.ru.unratedOne, 'Без рейтинга');
  assert.equal(dictionaries.ru.xp, 'опыт');
  assert.match(dictionaries.ru.noMatches, /Офлайн-тренировка не записывается в карьеру; матчи на сервере появятся здесь после завершения/);
  // The portal source carries no MMR or XP literal any more.
  const source = await readFile(new URL('../src/components/portal.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /['"> ]MMR['"<]|['"> ]XP['"<]/);
  assert.doesNotMatch(source, /m\.unrated_reason:''/);
});
