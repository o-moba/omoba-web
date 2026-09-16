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

test('device and Supporter routes remain a narrow browser allowlist',()=>{
  for (const path of ['me/devices','me/supporter']) assert.equal(allowedPath(path,'GET'),true);
  for (const path of ['me/devices/lookup','me/devices/approve','me/recovery-codes','me/supporter/solana/checkout','me/supporter/solana/confirm']) assert.equal(allowedPath(path,'POST'),true);
  assert.equal(allowedPath('me/supporter/aura','PATCH'),true);
  assert.equal(allowedPath('me/devices/'+'a'.repeat(64),'DELETE'),true);
  for (const path of ['auth/devices/create','auth/devices/recover','supporter/native','supporter/apple/notifications','me/supporter/apple/verify','me/supporter/grant','me/devices/approve/admin']) {
    assert.equal(allowedPath(path,'POST'),false);
  }
  assert.equal(allowedPath('me/recovery-codes','GET'),false);
  assert.equal(allowedPath('me/devices/'+'a'.repeat(63),'DELETE'),false);
});
