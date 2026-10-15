import test from 'node:test';
import assert from 'node:assert/strict';
import nextCookies from 'next/dist/compiled/@edge-runtime/cookies/index.js';
import { allowedPath, mutationAllowed, portalConfig, cookieNames, cookieOptions, expireCookie } from '../src/lib/security.mjs';

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
test('account mode is explicit and local development stays enabled by default',()=>{
  assert.equal(portalConfig({}).accountEnabled,true);
  assert.equal(portalConfig({OMOBA_ACCOUNT_MODE:'enabled'}).accountEnabled,true);
  assert.equal(portalConfig({OMOBA_ACCOUNT_MODE:'disabled',OMOBA_PORTAL_ORIGIN:'https://app.omoba.io',NODE_ENV:'production'}).accountEnabled,false);
  assert.throws(()=>portalConfig({OMOBA_ACCOUNT_MODE:'disable'}),/Invalid account mode/);
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

test('public recognition exposes only its directory read and authenticated preference patch', () => {
  assert.equal(allowedPath('supporters', 'GET'), true);
  assert.equal(allowedPath('me/supporter/recognition', 'PATCH'), true);
  for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal(allowedPath('supporters', method), false);
  for (const method of ['GET', 'POST', 'DELETE']) assert.equal(allowedPath('me/supporter/recognition', method), false);
  for (const path of ['supporters/admin', 'supporters/' + 'a'.repeat(64), 'me/supporter/months', 'me/supporter/recognition/grant']) {
    for (const method of ['GET', 'PATCH', 'POST', 'DELETE']) assert.equal(allowedPath(path, method), false);
  }
});
test('cookie expiry keeps the attributes a __Host- cookie was set with',()=>{
  // Next's own serializer: a browser ignores a __Host- Set-Cookie without Secure.
  for (const secure of [true,false]) {
    const headers=new Headers(), jar=new nextCookies.ResponseCookies(headers);
    const name=cookieNames(secure).session;
    jar.set(name,'a'.repeat(64),{...cookieOptions(secure),maxAge:60});
    expireCookie(jar,name,secure);
    const [line,...rest]=headers.getSetCookie();
    assert.deepEqual(rest,[]);
    const attributes=line.split('; ');
    assert.equal(attributes[0],name+'=');
    for (const required of ['Path=/','Max-Age=0','HttpOnly','SameSite=lax']) assert.ok(attributes.includes(required),required+': '+line);
    assert.equal(attributes.includes('Secure'),secure,line);
    assert.equal(attributes.some(a=>a.startsWith('Domain=')),false,line);
  }
});
