import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPath, mutationAllowed, portalConfig, cookieNames } from '../src/lib/security.mjs';

test('BFF denies arbitrary proxies, trusted methods and native proofs',()=>{
  for(const path of ['https://evil.example','../me','auth/pairings/approve','matches/../../me','me/rating']) assert.equal(allowedPath(path,'POST'),false);
  assert.equal(allowedPath('me/statistics','GET'),true);
  assert.equal(allowedPath('matches/'+'a'.repeat(64),'GET'),true);
  assert.equal(allowedPath('me/settings','PATCH'),true);
  assert.equal(allowedPath('me/settings','GET'),false);
});
test('mutations require exact origin and matching unpredictable cookie token',()=>{
  const token='a'.repeat(64);
  assert.equal(mutationAllowed('https://players.example','https://players.example',token,token),true);
  assert.equal(mutationAllowed('https://evil.example','https://players.example',token,token),false);
  assert.equal(mutationAllowed(null,'https://players.example',token,token),false);
  assert.equal(mutationAllowed('https://players.example','https://players.example','b'.repeat(64),token),false);
});
test('configuration disallows remote HTTP, embedded credentials and arbitrary paths',()=>{
  for(const url of ['http://players.example','https://u:p@players.example','https://players.example/api']) assert.throws(()=>portalConfig({OMOBA_PORTAL_ORIGIN:url}));
  assert.throws(()=>portalConfig({NODE_ENV:'production'}));
  assert.equal(portalConfig({NODE_ENV:'production',OMOBA_ALLOW_INSECURE_LOCAL:'1'}).secure,false);
  assert.ok(cookieNames(true).session.startsWith('__Host-'));
});
