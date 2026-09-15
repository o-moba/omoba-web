// Fixed-rate local acceptance workload, 50 sessions, 20 RPS, 15 minutes by default.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const game=process.env.OMOBA_GAME_WORKTREE||'/Users/wotori/git/ekza/omoba-bevy-player-portal';
const secret=Buffer.from((await readFile(game+'/.agent/tasks/PLAYER-PORTAL-2026-09-15/portal-test-secret','utf8')).trim(),'hex');
const md5=s=>createHash('md5').update(s).digest('hex');const hex=()=>randomBytes(32).toString('hex');const now=Math.floor(Date.now()/1000);
const users=Array.from({length:50},(_,i)=>({profile:md5('portal-benchmark-v2-'+i)+md5('profile-v2-'+i),session:hex(),token:hex()}));
const values=users.map(u=>`('${u.session}','${u.profile}','${createHmac('sha256',secret).update(JSON.stringify(['session-token',u.token])).digest('hex')}',${now},${now},${now+86400})`).join(',');
execFileSync('/Applications/Postgres.app/Contents/Versions/18/bin/psql',['-h','127.0.0.1','-p','55581','-d','postgres','-v','ON_ERROR_STOP=1','-q','-f','-'],{input:'INSERT INTO portal.web_sessions(session_id,profile_id,token_hash,created_at,last_seen,expires_at) VALUES '+values+';',stdio:['pipe','pipe','pipe']});
const distribution=JSON.parse(execFileSync('/Applications/Postgres.app/Contents/Versions/18/bin/psql',['-h','127.0.0.1','-p','55581','-d','postgres','-Atc',"SELECT json_build_object('profiles',count(*),'min_matches',min(n),'max_matches',max(n),'facts',sum(n)) FROM (SELECT profile_id,count(*) n FROM portal.player_match_facts WHERE result_id LIKE 'portal-load-v2-%' GROUP BY profile_id) d"],{encoding:'utf8'}));
if(distribution.profiles!==10000||distribution.min_matches!==100||distribution.max_matches!==100||distribution.facts!==1000000)throw new Error('Invalid synthetic benchmark distribution');
const seconds=Number(process.env.OMOBA_LOAD_SECONDS||900),rps=20,total=seconds*rps;const rows=[],pending=new Set();let peak=0;const begin=performance.now();
for(let i=0;i<total;i++){
  const wait=begin+i*1000/rps-performance.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));
  const user=users[i%50];const bucket=(i+Math.floor(i/50))%10;const kind=bucket<5?'profile':bucket<8?'history':'statistics';const path=kind==='profile'?'me':kind==='history'?'me/matches?days=all&limit=20':'me/statistics?days=90&rated=all';
  if(pending.size>=50){rows.push({kind,ms:12000,status:0});continue;}
  const job=(async()=>{const start=performance.now();try{const response=await fetch('http://127.0.0.1:3010/api/'+path,{headers:{Cookie:'omoba-session='+user.token},signal:AbortSignal.timeout(12000)});const body=await response.json();rows.push({kind,ms:performance.now()-start,status:response.status,valid:kind!=='profile'||body.profile?.profile_id===user.profile});}catch{rows.push({kind,ms:performance.now()-start,status:0});}})();pending.add(job);peak=Math.max(peak,pending.size);job.finally(()=>pending.delete(job));
  if(i%1200===0)console.log(`load ${i}/${total}; active ${pending.size}`);
}
await Promise.all(pending);const percentile=(a,p)=>a.sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))];const result={fixture:distribution,duration_seconds:(performance.now()-begin)/1000,requests:rows.length,target_rps:rps,sessions:50,peak_concurrency:peak,error_rate:rows.filter(r=>r.status!==200||r.valid===false).length/rows.length,by_endpoint:Object.fromEntries(['profile','history','statistics'].map(k=>{const a=rows.filter(r=>r.kind===k);return[k,{count:a.length,p50_ms:percentile(a.map(r=>r.ms),.5),p95_ms:percentile(a.map(r=>r.ms),.95),p99_ms:percentile(a.map(r=>r.ms),.99),errors:a.filter(r=>r.status!==200||r.valid===false).length}]})),status_counts:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})};
result.passed=result.error_rate<.01&&result.by_endpoint.profile.p95_ms<500&&result.by_endpoint.history.p95_ms<500&&result.by_endpoint.statistics.p95_ms<1000;
await mkdir('.agent/load',{recursive:true});await writeFile('.agent/load/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
