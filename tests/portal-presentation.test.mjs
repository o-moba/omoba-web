import test from 'node:test';
import assert from 'node:assert/strict';
import { resultTone, playerResult, teamSummaries, recordRate, meterPercent, ratingBounds, classArtwork, classDisplayName, teamDisplayName, presentationWords } from '../src/lib/portal-presentation.mjs';

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
  assert.equal(classDisplayName('future_class'), 'future_class');
  assert.equal(teamDisplayName('green', 'en'), 'Green');
  assert.equal(teamDisplayName('blue', 'ru'), 'синих');
  assert.equal(teamDisplayName('future-team', 'ru'), 'future-team');
  for (const locale of ['en', 'ru', 'zh']) assert.deepEqual(Object.keys(presentationWords(locale)), Object.keys(presentationWords('en')));
});
