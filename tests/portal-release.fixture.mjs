// Synthetic loopback Account API for release UI verification. Never product data.
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PREVIEW_SESSION='f'.repeat(64);
export const PREVIEW_SOCIAL='e'.repeat(64);
export const PREVIEW_NEW_SESSION='9'.repeat(64);
export const PREVIEW_ACCOUNT={profile:{profile_id:'a'.repeat(64),nickname:'Preview Ranger#2048',rating:1042,rated_matches:12,matches_played:12,wins:7,losses:5,progression_xp:'5400',level:'11'},settings:{public_profile_enabled:true,public_stats_enabled:true,discoverable:true,locale:'en',timezone:'UTC',version:'1'},rules:{newcomer_matches:10},session:{session_id:'c'.repeat(64)},social:[{provider:'vk',method:'vkid',linked_at:'2026-10-20T10:00:00Z'}]};
const stats=(i,team)=>({kills:(team==='blue'?[8,4,3,2,1]:[3,2,1,2,1])[i],deaths:(team==='blue'?[1,2,1,3,2]:[5,4,4,3,2])[i],assists:8-i,damage_to_heroes:12840-i*1500+(team==='red'?-1800:0),damage_to_structures:1800-i*240,damage_to_creeps:5200-i*500,damage_taken:6400+i*400,minion_last_hits:70-i*6,jungle_last_hits:12-i,structures_destroyed:i===0?2:0,final_level:11-i});
const participants=['blue','red'].flatMap(team=>Array.from({length:5},(_,i)=>({player_id:`${team}-${i}`,profile_id:team==='blue'&&i===0?PREVIEW_ACCOUNT.profile.profile_id:(team==='blue'?'b':'d').repeat(63)+i,nickname:team==='blue'&&i===0?PREVIEW_ACCOUNT.profile.nickname:['Nova','Eclipse','Thorn','Aster','Haze'][i]+'#'+(3000+i+(team==='blue'?10:20)),team,hero_class:['Ranger','Warrior','Mage','Cleric','Warrior'][i],avatar:null,sprite_character:null,is_bot:false,disconnected:false,stats:stats(i,team),rating:{before:1023,after:team==='blue'?1042:1007,delta:team==='blue'?19:-16},progression_xp_gained:team==='blue'?250:120})));
const report={result_id:'preview-match-1',ended_at:'2026-10-28T12:30:00Z',started_at:'2026-10-28T12:18:00Z',duration_ms:'720000',outcome:'completed',winner:'blue',rated:true,unrated_reason:null,participants,map_profile:'standard',ruleset:'standard'};
const history=[['completed',true,19],['completed',false,-8],['interrupted',null,null],['abandoned',null,null]].map(([outcome,won,delta],i)=>({result_id:'preview-match-'+(i+1),ended_at:new Date(Date.parse(report.ended_at)-i*86400000).toISOString(),duration_ms:i===2?'240000':'720000',outcome,won,rated:delta!==null,hero_class:i%2?'Mage':'Ranger',avatar:null,kills:8-i,deaths:1+i,assists:5+i,damage_to_heroes:12840-i*1100,rating:delta===null?null:{before:1042-delta,after:1042,delta}}));
const aggregate={matches:12,wins:7,losses:5,kills:75,deaths:40,assists:82,kda:3.925,win_rate:7/12,damage_per_minute:870.6,minion_last_hits:678,jungle_last_hits:90};
const analytics={summary:aggregate,classes:[{...aggregate,hero_class:'Ranger',matches:8,wins:5,losses:3,win_rate:5/8},{...aggregate,hero_class:'Mage',matches:4,wins:2,losses:2,win_rate:.5}],rating:[{result_id:'preview-match-4',ended_at:'2026-10-24T12:00:00Z',before:996,after:1010,delta:14},{result_id:'preview-match-3',ended_at:'2026-10-25T12:00:00Z',before:1010,after:1002,delta:-8},{result_id:'preview-match-2',ended_at:'2026-10-26T12:00:00Z',before:1002,after:1023,delta:21},{result_id:'preview-match-1',ended_at:report.ended_at,before:1023,after:1042,delta:19}],rating_truncated:false,projection_status:'ready',pending_results:0,data_as_of:report.ended_at};

export function previewApi() {
 return createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');let raw='';for await(const chunk of req)raw+=chunk;
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const body=raw?JSON.parse(raw):{};
  if(url.pathname==='/v1/auth/pairings')return send(200,{pair_id:'1'.repeat(64),poll_secret:'2'.repeat(64),code:'PREV2345',expires_at:new Date(Date.now()+300000).toISOString()});
  if(url.pathname==='/v1/auth/pairings/status')return send(200,{state:'approved'});
  if(url.pathname==='/v1/auth/pairings/complete')return send(200,{session_token:PREVIEW_SESSION});
  if(url.pathname==='/v1/auth/pairings/cancel')return send(200,{status:'cancelled'});
  if(url.pathname==='/v1/auth/social/vk')return body.code==='preview-new'?(body.register===true?send(200,{state:'signed_in',session_token:PREVIEW_NEW_SESSION}):send(200,{state:'unlinked',social_ticket:PREVIEW_SOCIAL,expires_at:new Date(Date.now()+300000).toISOString()})):send(200,{state:'signed_in',session_token:PREVIEW_SESSION});
  if(url.pathname==='/v1/auth/social/ticket')return send(200,{display_name:'Preview VK',expires_at:new Date(Date.now()+300000).toISOString()});
  if(url.pathname==='/v1/releases')return send(200,{releases:[]});
  if(![PREVIEW_SESSION,PREVIEW_NEW_SESSION].some(token=>req.headers.authorization==='Bearer '+token))return send(401,{code:'unauthorized'});
  if(url.pathname==='/v1/auth/logout')return send(200,{status:'revoked'});
  if(url.pathname==='/v1/me')return send(200,req.headers.authorization==='Bearer '+PREVIEW_NEW_SESSION?{...PREVIEW_ACCOUNT,profile:{...PREVIEW_ACCOUNT.profile,profile_id:'8'.repeat(64),nickname:'Preview VK',matches_played:0,progression_xp:'0'}}:PREVIEW_ACCOUNT);
  if(url.pathname==='/v1/me/matches'){
   let matches=history;const hero=url.searchParams.get('hero_class'),outcome=url.searchParams.get('outcome');
   // Deterministic slow filter for verifying stale-row transitions in the UI.
   if(hero?.toLowerCase()==='mage')await new Promise(resolve=>setTimeout(resolve,2500));
   if(hero)matches=matches.filter(match=>match.hero_class.toLowerCase()===hero.toLowerCase());
   if(outcome)matches=matches.filter(match=>outcome==='win'?match.won===true:outcome==='loss'?match.won===false:match.outcome===outcome);
   return send(200,{matches,next_cursor:null,data_as_of:report.ended_at});
  }
  if(url.pathname==='/v1/me/statistics')return send(200,analytics);
  if(url.pathname.startsWith('/v1/matches/')){const id=url.pathname.split('/').pop(),outcome=id.endsWith('3')?'interrupted':id.endsWith('4')?'abandoned':'completed';return send(200,{match:{...report,result_id:id,outcome,winner:outcome==='completed'?'blue':null,rated:outcome==='completed'}});}
  if(url.pathname==='/v1/me/friends')return send(200,{friends:[],incoming:[],outgoing:[],data_as_of:report.ended_at});
  if(url.pathname==='/v1/players')return send(200,{players:[]});
  return send(404,{code:'not_found'});
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const server=previewApi();server.listen(40558,'127.0.0.1',()=>console.log('Synthetic release preview API on 127.0.0.1:40558'));
}
