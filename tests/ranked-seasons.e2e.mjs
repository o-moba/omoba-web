// Real production Next + Chrome, synthetic loopback Account API. This proves
// presentation only; PostgreSQL/privacy/runtime grants are checked in game tests.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {chromium} from '@playwright/test';

const out=process.env.OMOBA_SEASON_EVIDENCE_DIR||'.agent/browser/ranked-seasons';
await mkdir(out,{recursive:true});
const id='a'.repeat(64),friendId='b'.repeat(64),started=Date.UTC(2026,10,6),end=started+7776000000;
let state='placement';
const badge={season_id:1,ended_at_ms:started,rating:2300,rated_matches:40,tier:'platinum'};
function profile(){
 const p={profile_id:id,nickname:'Игрок#1234',rating:1650,rated_matches:100,matches_played:120,wins:60,losses:40,abandons:0,completed_public_matches:10,progression_xp:'18000',level:'19'};
 if(state!=='legacy')p.ranked={season_id:2,started_at_ms:started,ends_at_ms:end,rated_matches:state==='calibrated'?20:0,wins:state==='calibrated'?12:0,losses:state==='calibrated'?8:0,completed_matches:state==='calibrated'?20:0,latest_badge:badge};
 if(state==='calibrated')p.rating=2300;
 if(state!=='legacy')p.ranked_archive=[{season_id:1,started_at_ms:started-7776000000,ends_at_ms:started,rating:2300,rated_matches:40,wins:24,losses:16,completed_matches:40,badge}];
 return p;
}
const account=()=>({profile:profile(),settings:{public_profile_enabled:true,public_stats_enabled:true,discoverable:false,leaderboard_listed:true,locale:'ru',timezone:'UTC',version:'1'},rules:{newcomer_matches:20},session:{session_id:'fixture'},social:[]});
const unexpected=[];
const fixture=createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 let value;
 if(path==='/v1/me')value=account();
 else if(path==='/v1/me/matches')value={matches:[],next_cursor:null,data_as_of:new Date().toISOString()};
 else if(path==='/v1/me/friends')value={friends:[{profile:{...profile(),profile_id:friendId,nickname:'Друг#2345'},presence:'online',etag:'1'}],incoming:[],outgoing:[]};
 else if(path==='/v1/players/'+id)value={profile:state==='hidden'?{profile_id:id,nickname:'Игрок#1234'}:profile(),access:'public'};
 else if(path==='/v1/leaderboard'){
  const p=profile();if(p.ranked)delete p.ranked.latest_badge;value={entries:state==='placement'?[]:[{...p,rank:1}],me:{...p,rank:state==='placement'?null:1,listed:true},min_rated_matches:20,data_as_of:new Date().toISOString()};
 }else{unexpected.push(path);res.writeHead(404);res.end('{"code":"fixture_route_missing"}');return;}
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const origin='http://127.0.0.1:'+port,api='http://127.0.0.1:'+fixture.address().port;
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('OMOBA_')));
Object.assign(env,{PORT:String(port),OMOBA_MARKET:'ru',OMOBA_PORTAL_ORIGIN:origin,OMOBA_ACCOUNT_API_URL:api,OMOBA_ALLOW_INSECURE_LOCAL:'1',NO_PROXY:'127.0.0.1,localhost,::1',no_proxy:'127.0.0.1,localhost,::1'});
const log=await open(out+'/next.log','w');
const child=spawn(process.execPath,['scripts/start.mjs'],{env,stdio:['ignore',log.fd,log.fd]});
let browser;
const errors=[],checks=[],screenshots=[];
try{
 let ready=false;
 for(let n=0;n<100;n++){
  if(child.exitCode!==null)throw new Error('Next exited '+child.exitCode);
  try{if((await fetch(origin+'/me')).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,'bounded local startup');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
 const context=await browser.newContext({locale:'ru-RU',viewport:{width:852,height:393}});
 await context.addCookies([{name:'omoba-session',value:'c'.repeat(64),url:origin,httpOnly:true,sameSite:'Lax'},{name:'omoba_locale',value:'ru',url:origin}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort();});
 const capture=async(name)=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');await page.screenshot({path:out+'/'+name+'.png',fullPage:true});screenshots.push(name+'.png');};
 await page.goto(origin+'/me');
 await page.locator('[data-ranked-season]').waitFor();
 assert.match(await page.locator('main').innerText(),/Калибровка 0\/20/);
 assert.match(await page.locator('[data-season-badge]').innerText(),/Платина.*2.?300/s);
 assert.equal(await page.locator('[data-ranked-archive] li').count(),1);
 await capture('reset-and-old-badge');checks.push('season reset shows0/20 despite100 lifetime; old platinum2300 badge/archive preserved');
 await page.goto(origin+'/leaderboard');
 await page.locator('.leaderboard-me').waitFor();
 assert.match(await page.locator('.leaderboard-me').innerText(),/0\/20/);
 assert.doesNotMatch(await page.locator('.leaderboard-me').innerText(),/100\/20/);
 checks.push('leaderboard placement uses current-season count');
 state='calibrated';await page.reload();
 await page.locator('[data-leaderboard] tbody tr').waitFor();
 assert.match(await page.locator('[data-leaderboard] tbody tr').innerText(),/Платина/);
 assert.equal(await page.locator('[data-leaderboard] tbody tr td').nth(3).innerText(),'20');
 await capture('calibrated-ladder');checks.push('calibrated ladder shows platinum,20 seasonal games and seasonal record');
 await page.goto(origin+'/friends');await page.locator('.friend-row .ranked-tag').waitFor();
 assert.match(await page.locator('.friend-row .ranked-tag').innerText(),/Платина/);checks.push('friend tier');
 state='hidden';await page.goto(origin+'/players/'+id);await page.locator('main h2').waitFor();
 assert.equal(await page.locator('main [data-ranked-season],main [data-ranked-archive],main [data-season-badge]').count(),0);checks.push('hidden public stats render no season/archive/badge');
 state='legacy';await page.goto(origin+'/me');await page.locator('.ranked-tag').first().waitFor();
 assert.match(await page.locator('main').innerText(),/Золото/);
 assert.equal(await page.locator('[data-ranked-archive],[data-season-badge]').count(),0);checks.push('old API compatibility uses lifetime and omits absent archive');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 await writeFile(out+'/report.json',JSON.stringify({status:'PASS',scope:'production Next + Chrome with synthetic loopback API; not PostgreSQL or physical device',locale:'ru',viewport:[852,393],checks,screenshots,page_errors:errors,unexpected_api:unexpected},null,2)+'\n');
 console.log('PASS ranked season presentation: '+checks.length+' checks');
}finally{
 if(browser)await browser.close();
 if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,5000))]);}
 await new Promise(resolve=>fixture.close(resolve));await log.close();
}
