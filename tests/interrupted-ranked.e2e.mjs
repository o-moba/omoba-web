// Focused RU390x844 presentation proof using a synthetic loopback Account API
// and an existing production Next build. No live account or DB is contacted.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,open,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
const out=process.env.OMOBA_INTERRUPTED_EVIDENCE_DIR||'.agent/browser/interrupted-ranked';
await mkdir(out,{recursive:true});
const me='a'.repeat(64),id='qa-interrupted-ranked',now='2026-11-07T00:00:00Z';
const profile={profile_id:me,nickname:'QA Игрок#0001',rating:1000,rated_matches:21,matches_played:31,wins:16,losses:15,abandons:0,progression_xp:'2500',level:'3'};
const account={profile,settings:{public_profile_enabled:false,public_stats_enabled:false,discoverable:false,leaderboard_listed:true,locale:'ru',timezone:'UTC',version:'1'},rules:{newcomer_matches:20},session:{session_id:'synthetic'},social:[]};
const participants=Array.from({length:10},(_,i)=>({player_id:String(i+1),profile_id:i===0?me:String(i+2).padStart(64,'0'),nickname:i===0?profile.nickname:`QA Peer ${i}#0001`,team:i<5?'green':'blue',hero_class:'mage',character:'ipfs',avatar:null,sprite_character:null,is_bot:false,disconnected:false,stats:{kills:0,deaths:0,assists:0,damage_to_heroes:0,damage_to_structures:0,damage_to_creeps:0,damage_taken:0,minion_last_hits:0,jungle_last_hits:0,structures_destroyed:0,final_level:1},rating:null,progression_xp_gained:0}));
const match={result_id:id,ended_at:now,started_at:now,duration_ms:'120000',outcome:'interrupted',winner:null,rated:true,unrated_reason:'server_interrupted',participants,map_profile:'verdant_default',ruleset:'verdant-default-v1'};
const history={matches:[{result_id:id,ended_at:now,duration_ms:'120000',outcome:'interrupted',won:null,rated:true,hero_class:'mage',avatar:null,kills:0,deaths:0,assists:0,damage_to_heroes:0,rating:null}],next_cursor:null,data_as_of:now};
const unknown=[];
const api=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 let value;
 if(pathname==='/v1/me')value=account;
 else if(pathname==='/v1/me/matches')value=history;
 else if(pathname==='/v1/matches/'+id)value={match};
 else if(pathname==='/v1/me/friends')value={friends:[],incoming:[],outgoing:[],data_as_of:now};
 else{unknown.push(pathname);res.statusCode=404;value={error:'unknown_fixture_route'};}
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));
});
await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const origin=`http://127.0.0.1:${port}`,log=await open(out+'/next.log','w');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('OMOBA_')));
Object.assign(env,{HOSTNAME:'127.0.0.1',PORT:String(port),OMOBA_CONTOUR:'production',OMOBA_MARKET:'ru',OMOBA_PORTAL_ORIGIN:origin,OMOBA_ACCOUNT_API_URL:`http://127.0.0.1:${api.address().port}`,OMOBA_ALLOW_INSECURE_LOCAL:'1',NEXT_TELEMETRY_DISABLED:'1',NO_PROXY:'127.0.0.1,localhost,::1',no_proxy:'127.0.0.1,localhost,::1'});
const child=spawn(process.execPath,['.next/standalone/server.js'],{env,detached:true,stdio:['ignore',log.fd,log.fd]});
let browser;
const checks=[],screenshots=[],errors=[];
try{
 let ready=false;
 for(let n=0;n<100;n++){
  if(child.exitCode!==null)throw new Error('owned Next server exited; inspect '+out+'/next.log');
  try{if((await fetch(origin+'/me',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,'bounded production startup');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-proxy-server']});
 const context=await browser.newContext({locale:'ru-RU',viewport:{width:390,height:844}});
 await context.addCookies([{name:'omoba-session',value:'b'.repeat(64),url:origin,httpOnly:true,sameSite:'Lax'},{name:'omoba_locale',value:'ru',url:origin,sameSite:'Lax'}]);
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const capture=async(name)=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');await page.screenshot({path:out+'/'+name+'.png',fullPage:true});screenshots.push(name+'.png');};
 await page.goto(origin+'/me');await page.locator('.match-row').waitFor();
 const row=page.locator('.match-row');
 assert.equal(await row.locator('.match-end b').innerText(),'—');
 assert.equal(await row.locator('.outcome-label').innerText(),'Прерван');
 assert.doesNotMatch(await row.innerText(),/Не рейтинговые|Без рейтинга/);
 checks.push('rated:true/rating:null interrupted history keeps dash and neutral result');
 await capture('phone-history');
 await row.click();await page.locator('.match-banner h1').waitFor();
 assert.equal(await page.locator('.match-meta .tag').innerText(),'Рейтинговый');
 assert.equal(await page.locator('.match-banner h1').innerText(),'Прерван');
 assert.equal(await page.locator('.score-team.won,.score-team.lost').count(),0);
 checks.push('interrupted Ranked detail retains singular ranked tag and no winning side');
 await page.locator('details.mine summary').click();
 const rating=page.locator('details.mine .metric').filter({has:page.locator('span',{hasText:/^Рейтинг$/})});
 assert.equal(await rating.locator('strong').innerText(),'—');
 checks.push('missing personal rating award stays dash rather than zero');
 await capture('phone-match');
 assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);
 const sha=async(path)=>createHash('sha256').update(await readFile(path)).digest('hex');
 const report={status:'PASS',scope:'synthetic Account API, real owned production Next/Chrome; presentation only, not PostgreSQL or physical device',source_parent:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_sha256:Object.fromEntries(await Promise.all(['src/components/portal.tsx','src/lib/i18n.ts','tests/interrupted-ranked.e2e.mjs'].map(async p=>[p,await sha(p)]))),existing_build_id:(await readFile('.next/BUILD_ID','utf8')).trim(),existing_server_sha256:await sha('.next/standalone/server.js'),locale:'ru',viewport:[390,844],checks,screenshots:await Promise.all(screenshots.map(async name=>({name,sha256:await sha(out+'/'+name)}))),errors,unexpected_api_routes:unknown};
 await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log('PASS interrupted Ranked presentation; '+out);
}finally{
 if(browser)await browser.close();
 const exited=once(child,'exit').catch(()=>{});try{process.kill(-child.pid,'SIGTERM');}catch{}
 await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);
 if(child.exitCode===null&&child.signalCode===null){try{process.kill(-child.pid,'SIGKILL');}catch{}}
 api.closeAllConnections();await new Promise(resolve=>api.close(resolve));await log.close();
}
