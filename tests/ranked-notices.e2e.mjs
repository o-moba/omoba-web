// Real production Next + Chrome, synthetic loopback Account API. This proves
// presentation only; PostgreSQL/privacy/runtime grants are checked in game tests.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {chromium} from '@playwright/test';

const out=process.env.OMOBA_SEASON_EVIDENCE_DIR||'.agent/browser/ranked-notices';
await mkdir(out,{recursive:true});
const id='a'.repeat(64),friendId='b'.repeat(64),started=Date.UTC(2026,10,6),end=started+7776000000;
let current={profile_id:id,rating:1490,count:19,completed:19,abandons:0,season_id:2};
function profile(){return {profile_id:current.profile_id,nickname:current.profile_id===id?'Игрок#1234':'Другой#2345',rating:current.rating,rated_matches:100,matches_played:120,wins:60,losses:40,abandons:current.abandons,completed_public_matches:10,progression_xp:'18000',level:'19',ranked:{season_id:current.season_id,started_at_ms:started,ends_at_ms:end,rated_matches:current.count,wins:0,losses:current.count,completed_matches:current.completed}};}
const account=()=>({profile:profile(),settings:{public_profile_enabled:true,public_stats_enabled:true,discoverable:false,leaderboard_listed:true,locale:'ru',timezone:'UTC',version:'1'},rules:{newcomer_matches:20},session:{session_id:'fixture'},social:[]});
const unexpected=[];
const fixture=createServer((req,res)=>{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 let value;
 if(path==='/v1/me')value=account();
 else if(path==='/v1/me/matches')value={matches:[],next_cursor:null,data_as_of:new Date().toISOString()};
 else{unexpected.push(path);res.writeHead(404);res.end('{"code":"fixture_route_missing"}');return;}
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
 const capture=async(name)=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');await page.screenshot({path:out+'/'+name+'.png',fullPage:false});screenshots.push(name+'.png');};
 const notice=page.locator('[data-ranked-notice]');
 const metric=()=>page.locator('.career-metrics .metric strong').first();
 const settle=async()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const refresh=async(next)=>{
  current={...current,...next};
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/me');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal((await response).status(),200);
  await page.waitForFunction(r=>document.querySelector('.career-metrics .metric strong')?.textContent.replace(/\s/g,'')===String(r),current.rating);
  await settle();
 };
 const baseline=async(next)=>{
  current={profile_id:id,rating:1490,count:19,completed:19,abandons:0,season_id:2,...next};
  await page.goto(origin+'/me');await metric().waitFor();await settle();assert.equal(await notice.count(),0,'no first-load announcement');
 };
 await baseline({});
 await refresh({rating:1510,count:20,completed:20});
 await page.locator('[data-ranked-notice="calibrated"]').waitFor();
 assert.match(await notice.innerText(),/Калибровка завершена: Золото/);
 await capture('calibration');checks.push('honest final placement announces calibration without a page reload');
 await notice.getByRole('button',{name:'Скрыть уведомление'}).click();
 await refresh({});assert.equal(await notice.count(),0,'same award does not repeat after dismissal');
 checks.push('dismissal and repeated poll do not replay a notice');
 await baseline({count:20,completed:20});
 await refresh({rating:1510,count:21,completed:21});
 await page.locator('[data-ranked-notice="promoted"]').waitFor();
 assert.match(await notice.innerText(),/Новый ранг: Золото/);checks.push('promotion');
 await notice.getByRole('button').click();
 await refresh({rating:1490,count:20,completed:20});assert.equal(await notice.count(),0);
 await refresh({rating:1510,count:21,completed:21});assert.equal(await notice.count(),0);
 checks.push('late older snapshot then replay stays silent');
 await refresh({rating:1478,count:22,completed:21,abandons:1});
 await page.locator('[data-ranked-notice="demoted"]').waitFor();
 assert.match(await notice.innerText(),/Ранг понижен: Серебро/);
 await capture('personal-penalty-demotion');checks.push('personal leaver penalty can demote without honest completed-game credit');
 await refresh({rating:1239,count:0,completed:0,season_id:3});assert.equal(await notice.count(),0);
 await refresh({profile_id:friendId,rating:2300,count:40,completed:40});assert.equal(await notice.count(),0);
 checks.push('season reset and another account clear the old notice and seed silently');
 await baseline({});
 await refresh({rating:1510,count:20,completed:19,abandons:1});assert.equal(await notice.count(),0);
 checks.push('a penalty crossing the calibration threshold never celebrates');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 await writeFile(out+'/report.json',JSON.stringify({status:'PASS',scope:'production Next + Chrome with synthetic loopback API; not PostgreSQL or physical device',locale:'ru',viewport:[852,393],checks,screenshots,page_errors:errors,unexpected_api:unexpected},null,2)+'\n');
 console.log('PASS ranked change notices: '+checks.length+' checks');
}finally{
 if(browser)await browser.close();
 if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,5000))]);}
 await new Promise(resolve=>fixture.close(resolve));await log.close();
}
