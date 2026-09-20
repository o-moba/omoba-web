// Own disposable PostgreSQL only. Never point this test at production.
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHmac,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const game=process.env.OMOBA_GAME_WORKTREE||new URL('../../omoba-bevy',import.meta.url).pathname;
const base=game+'/.agent/tasks/PLAYER-PORTAL-2026-09-15',pg='/Applications/Postgres.app/Contents/Versions/18/bin/',db=base+'/postgres';
const secret=Buffer.from((await readFile(base+'/portal-test-secret','utf8')).trim(),'hex');
const profile=createHash('md5').update('portal-benchmark-v2-49').digest('hex')+createHash('md5').update('profile-v2-49').digest('hex');
const token=randomBytes(32).toString('hex'),id=randomBytes(32).toString('hex'),hash=createHmac('sha256',secret).update(JSON.stringify(['session-token',token])).digest('hex');
execFileSync(pg+'psql',['-h','127.0.0.1','-p','55581','-d','postgres','-v','ON_ERROR_STOP=1','-q','-f','-'],{input:`INSERT INTO portal.web_sessions(session_id,profile_id,token_hash,created_at,last_seen,expires_at) VALUES('${id}','${profile}','${hash}',extract(epoch from now()),extract(epoch from now()),extract(epoch from now())+3600);`,stdio:['pipe','pipe','pipe']});
const browser=await chromium.launch({channel:'chrome',headless:true});let stopped=false;
function start(){execFileSync(pg+'pg_ctl',['-D',db,'-l',base+'/raw/postgres-restart.log','-o','-h 127.0.0.1 -p 55581 -k /private/tmp','start'],{stdio:'pipe'});stopped=false;}
try{
 const c=await browser.newContext();await c.addCookies([{name:'omoba-session',value:token,url:'http://127.0.0.1:3010',httpOnly:true,sameSite:'Lax'}]);const p=await c.newPage();await p.goto('http://127.0.0.1:3010/me');await p.locator('.profile-strip').waitFor();const before=await(await p.request.get('http://127.0.0.1:3010/api/me')).json();assert.equal(before.profile.profile_id,profile);
 execFileSync(pg+'pg_ctl',['-D',db,'stop','-m','fast'],{stdio:'pipe'});stopped=true;
 assert.equal((await p.request.get('http://127.0.0.1:3010/api/me')).status(),503);await p.reload();await p.getByRole('alert').first().waitFor();await p.screenshot({path:'.agent/browser/database-outage.png',fullPage:true});
 start();for(let i=0;i<20;i++){const r=await fetch('http://127.0.0.1:40550/health/ready');if(r.ok)break;await new Promise(r=>setTimeout(r,500));}
 await p.reload();await p.locator('.profile-strip').waitFor();const after=await(await p.request.get('http://127.0.0.1:3010/api/me')).json();assert.deepEqual(after.profile,before.profile);
 await writeFile('.agent/browser/database-outage.json',JSON.stringify({passed:true,checks:['real PostgreSQL stop','authenticated BFF returns 503','UI error','same profile/rating after database restart','existing session survives infrastructure restart']},null,2));console.log('PASS real database outage and recovery');
}finally{if(stopped)start();execFileSync(pg+'psql',['-h','127.0.0.1','-p','55581','-d','postgres','-q','-f','-'],{input:`UPDATE portal.web_sessions SET revoked=true WHERE session_id='${id}';`,stdio:['pipe','pipe','pipe']});await browser.close();}
