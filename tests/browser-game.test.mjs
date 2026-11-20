import test from 'node:test';
import assert from 'node:assert/strict';
import { validBrowserGameManifest, browserGameMessage } from '../src/lib/browser-game.mjs';
import { portalReturnTo, portalLoginHref } from '../src/lib/navigation.mjs';
import { MARKET_PRESETS } from '../src/lib/market-profile.mjs';

const valid = {mode:'local-practice',entry:'index.html',version:'0.45.0',commit:'7ace97ce48ecb1a09f608ec0d44ef9b78a6431df'};
test('browser practice accepts only the expected local artifact profile',()=>{
  assert.equal(validBrowserGameManifest(valid),true);
  for(const value of [null,[],{...valid,mode:'ranked'},{...valid,entry:'https://other.example/'},{...valid,entry:'../login'},{...valid,commit:''},{...valid,version:''}]) assert.equal(validBrowserGameManifest(value),false);
});
test('readiness messages require the current child window and same origin',()=>{
  const source={}, origin='http://127.0.0.1:3010';
  const event={source,origin,data:{type:'omoba-practice-ready'}};
  assert.equal(browserGameMessage(event,source,origin),'ready');
  assert.equal(browserGameMessage({...event,data:{type:'omoba-practice-error'}},source,origin),'error');
  for(const wrong of [{...event,origin:'https://untrusted.example'},{...event,source:{}},{...event,data:{type:'navigate',url:'/settings'}},{...event,data:null}]) assert.equal(browserGameMessage(wrong,source,origin),null);
  assert.equal(browserGameMessage(event,null,origin),null);
});
test('VK and pairing can return to browser play in every market without redirect escapes',()=>{
  for(const features of Object.values(MARKET_PRESETS)) {
    assert.equal(portalReturnTo('/play',features),'/play');
    assert.equal(new URL(portalLoginHref('/play',features),'https://portal.invalid').searchParams.get('returnTo'),'/play');
    assert.equal(portalReturnTo('//play.example',features),'/me');
  }
});
