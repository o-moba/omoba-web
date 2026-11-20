import test from 'node:test';
import assert from 'node:assert/strict';
import {ratingTier,rankedProgress,earnedSeasonBadge,rankedWords,rankedTransition} from '../src/lib/ranked-seasons.mjs';
const season=(games=0)=>({season_id:2,started_at_ms:1000,ends_at_ms:7776001000,rated_matches:games,wins:0,losses:games,completed_matches:games});
test('all owner tier boundaries and placement calibration use season games',()=>{
  for(const [rating,tier] of [[0,'bronze'],[999,'bronze'],[1000,'silver'],[1499,'silver'],[1500,'gold'],[1999,'gold'],[2000,'platinum'],[2499,'platinum'],[2500,'diamond'],[2999,'diamond'],[3000,'master'],[5000,'master']]){
    assert.equal(ratingTier(rating),tier);
    assert.equal(rankedProgress({rating,rated_matches:100,ranked:season(19)}).tier,null);
    assert.equal(rankedProgress({rating,rated_matches:100,ranked:season(20)}).tier,tier);
  }
  assert.equal(rankedProgress({rating:1750,rated_matches:100,ranked:season(0)}).played,0);
  assert.equal(rankedProgress({rating:1750,rated_matches:100}).tier,'gold');
  assert.equal(rankedProgress({rating:1750,rated_matches:100}).seasonId,null);
});
test('hidden statistics and malformed new metadata never become a guessed tier',()=>{
  for(const p of [{},null,{rating:-1,rated_matches:30},{rating:1000,rated_matches:NaN},{rating:1000,rated_matches:30,ranked:{...season(),rated_matches:true}},{rating:1000,rated_matches:30,ranked:{...season(),season_id:-1}},{rating:1000,rated_matches:30,ranked:{...season(),ends_at_ms:2000}}])assert.equal(rankedProgress(p),null);
});
test('badge keeps its final old rating and provisional status across reset',()=>{
  const p={rating:1650,rated_matches:100,ranked:{...season(),latest_badge:{season_id:1,ended_at_ms:1000,rating:2300,rated_matches:20,tier:'platinum'}}};
  assert.equal(rankedProgress(p).tier,null);
  assert.deepEqual(earnedSeasonBadge(p),{seasonId:1,endedAt:1000,rating:2300,played:20,tier:'platinum'});
  p.ranked.latest_badge={season_id:1,ended_at_ms:1000,rating:2300,rated_matches:19};
  assert.equal(earnedSeasonBadge(p).tier,null);
  p.ranked.latest_badge.tier='future';assert.equal(earnedSeasonBadge(p),null);
  assert.equal(earnedSeasonBadge({ranked:p.ranked}),null);
});
test('ranked copy has six named tiers and preserved-progress explanation',()=>{
  for(const locale of ['ru','en','zh']){
    const words=rankedWords(locale);
    for(const key of ['bronze','silver','gold','platinum','diamond','master','placement','season','badge','help','archive','noBadge','ladderIntro'])assert.equal(typeof words[key],'string');
    assert.match(words.placement,/\{n\}.*\{total\}/);
  }
});

const observed=(count,rating=1510)=>({profile_id:'a'.repeat(64),rating,rated_matches:100,abandons:0,ranked:season(count)});
test('new honest awards announce calibration, promotion and personal-penalty demotion',()=>{
  assert.deepEqual(rankedTransition(observed(19,1490),observed(20)),{kind:'calibrated',tier:'gold',seasonId:2,played:20});
  assert.equal(rankedTransition(observed(19,1510),observed(20,1490)).kind,'calibrated','last placement loss still calibrates');
  assert.equal(rankedTransition(observed(20,1490),observed(21)).kind,'promoted');
  const leaver=observed(22,1478);leaver.abandons=1;leaver.ranked.completed_matches=21;
  assert.deepEqual(rankedTransition(observed(21),leaver),{kind:'demoted',tier:'silver',seasonId:2,played:22});
});
test('first load, another identity, season reset, replay, skipped games and stale counts stay silent',()=>{
  const old=observed(20,1490),next=observed(21);
  for(const [a,b] of [[null,next],[old,{...next,profile_id:'b'.repeat(64)}],[old,{...next,ranked:{...next.ranked,season_id:3}}],[next,next],[next,old],[old,observed(22)],[old,{...next,ranked:{...next.ranked,started_at_ms:2000,ends_at_ms:7776002000}}],[{...old,ranked:undefined},next],[old,{...next,ranked:{...next.ranked,rated_matches:true}}]])assert.equal(rankedTransition(a,b),null);
  assert.equal(rankedTransition(observed(20,1510),observed(21,1530)),null,'same tier');
  assert.equal(rankedTransition(observed(0,1490),observed(1)),null,'still provisional');
});
test('leaves, unknown participation and neutral remakes never celebrate a new tier',()=>{
  const old=observed(19,1490),honest=observed(20);
  for(const next of [{...honest,abandons:1},{...honest,abandons:undefined},{...honest,ranked:{...honest.ranked,completed_matches:19}}])assert.equal(rankedTransition(old,next),null);
  assert.equal(rankedTransition({...old,abandons:undefined},honest),null);
  assert.equal(rankedTransition(old,observed(19,1510)),null);
});
