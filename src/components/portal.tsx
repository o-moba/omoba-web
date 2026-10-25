'use client';
import { Brand } from '@/components/brand';
import { NavIcon } from '@/components/nav-icon';
import { DEFAULT_SITE_URL, GUEST_LINKS, PORTAL_NAV, mobileNav, portalNav, portalReturnTo, portalLoginHref } from '@/lib/navigation.mjs';
import Link from 'next/link';
import { api, ApiFailure } from '@/lib/client-api';
import DevicesView from './devices';
import ConnectView from './connect';
import { RegistrationView, VkSignInButtons, fill, useMethodLabel, useSigninFailure, type SocialTicket } from './social';
import { useMarket } from './market-profile';
import { LegalLinks, SignInLegalNotice } from './legal';
import { GuestHome, type GuestHomeData } from './guest-home';
import { ReleaseList } from './releases';
import { pageReleases } from '@/lib/releases.mjs';
import SupporterView from './supporter';
import SupportersView from './supporters';
import { HeroRecognitionBadge } from './hero-recognition';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { dictionaries, type Words } from '@/lib/i18n';
import { useLocale, LanguageSelector } from '@/components/locale-provider';
import type {Account,Profile,History,Friends,Match,Analytics,Sessions,Settings} from '@/lib/types';

function errorText(error:unknown,w:Words) {
  if(error instanceof ApiFailure){if(error.code==='handle_taken')return w.handleTaken;if(error.code==='player_not_found')return w.playerNotFound;if(error.status===404)return w.private;if(error.status===409)return w.conflict;
    if(error.status===429)return w.rateLimited;if(error.code==='fresh_confirmation_required')return w.freshLogin;
    if(error.status===401)return w.loginNeeded;if(error.status>=500)return w.unavailable;}
  return w.loadError;
}
function useData<T>(path:string|null) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{if(!path){setData(null);return;} let live=true;setBusy(true);setError(null);
    api<T>(path).then(value=>{if(live)setData(value);}).catch(e=>{if(live){setError(e);setData(null);}}).finally(()=>{if(live)setBusy(false);});
    return ()=>{live=false;};},[path,revision]);
  useEffect(()=>{if(!path)return;const refresh=()=>{if(document.visibilityState==='visible')setRevision(n=>n+1);};const timer=setInterval(refresh,path.startsWith('me/matches')?5000:30000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[path]);
  return {data,error,busy,refresh:()=>setRevision(n=>n+1)};
}
function Card({children,className=''}:{children:React.ReactNode;className?:string}) {return <section className={'card '+className}>{children}</section>;}
function Empty({text}:{text:string}){return <div className="empty"><span aria-hidden="true">◇</span><p>{text}</p></div>;}
function Status({error,busy,w,retry}:{error:unknown;busy:boolean;w:Words;retry:()=>void}){return <>{error?<div role="alert" className="notice error">{errorText(error,w)} <button onClick={retry}>{w.retry}</button></div>:null}{busy?<p role="status" className="muted">{w.loading}</p>:null}</>;}
const formatNumber=(n:number|string|null|undefined,locale:string)=>n==null?'—':typeof n==='string'?BigInt(n).toLocaleString(locale):new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n);
const duration=(ms:string)=>`${Math.floor(Number(ms)/60000)}:${String(Math.floor(Number(ms)/1000)%60).padStart(2,'0')}`;
function time(value:string,tz:string,locale:string){return new Date(value).toLocaleString(locale,{timeZone:tz,dateStyle:'medium',timeStyle:'short'});}
function outcome(won:boolean|null,state:string,w:Words){return state==='interrupted'?w.interrupted:state==='abandoned'?w.abandoned:won===null?w.outcome:won?w.victory:w.defeat;}
function ClassIcon({name}:{name:string}){return <span className={'class-icon '+name.toLowerCase()} aria-hidden="true">{name.slice(0,1)}</span>;}
function Metric({label,value,accent=false}:{label:string;value:React.ReactNode;accent?:boolean}){return <div className="metric"><span>{label}</span><strong className={accent?'accent':''}>{value}</strong></div>;}
function ProfileMetrics({p,w}:{p:Profile;w:Words}) {const {locale}=useLocale(); const number=(value:Parameters<typeof formatNumber>[0])=>formatNumber(value,locale); return <div className="metrics"><Metric label={w.rating} value={number(p.rating)} accent/><Metric label={w.level} value={number(p.level)}/><Metric label={w.wins} value={number(p.wins)}/><Metric label={w.winRate} value={p.wins!=null&&p.losses!=null&&p.wins+p.losses>0?number(100*p.wins/(p.wins+p.losses))+'%':'—'}/></div>;}
function Copy({value,w}:{value:string;w:Words}){const[done,setDone]=useState(false);return <button onClick={()=>navigator.clipboard.writeText(value).then(()=>setDone(true)).catch(()=>setDone(false))}>{done?w.copied:w.copy}</button>;}

function Login({w,onConnected,returnTo}:{w:Words;onConnected:()=>void;returnTo:string}) {
  const { t, locale } = useLocale();
  const { features } = useMarket();const failure=useSigninFailure()(useSearchParams().get('signin'));
  const[pair,setPair]=useState<{code:string;expires_at:string}|null>(null),[state,setState]=useState(''),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!pair)return;let live=true,active=false;const poll=async()=>{if(active)return;active=true;try {
    const result=await api<{state:string}>('auth/pairings/status','POST',{});if(!live)return;setState(result.state);
    if(result.state==='approved'||result.state==='consumed'){await api('auth/pairings/complete','POST',{});if(live){setPair(null);onConnected();}}
    if(['expired','denied','cancelled'].includes(result.state))setPair(null);
  }catch(e){if(live)setError(e);}finally{active=false;}}; const timer=setInterval(poll,3000);return()=>{live=false;clearInterval(timer);};},[pair,onConnected]);
  async function start(){setBusy(true);setError(null);try{setPair(await api('auth/pairings','POST',{}));setState('pending');}catch(e){setError(e);}finally{setBusy(false);}}
  // Markets with VK ID (ru): VK, OK and Mail.ru first; game pairing stays the secondary path.
  const pairing=<>{pair?<><div className="pair-code" aria-label={pair.code}>{pair.code.slice(0,4)}—{pair.code.slice(4)}</div><p>{w.pairHelp}</p><p role="status" className="accent">{w.awaiting}</p><time className="muted">{new Date(pair.expires_at).toLocaleTimeString(locale)}</time><div><button onClick={async()=>{try{await api('auth/pairings/cancel','POST',{});setPair(null);setState('cancelled');}catch(e){setError(e);}}}>{w.cancel}</button></div></>:<><p role="status">{state==='denied'?w.denied:['expired','cancelled'].includes(state)?w.expired:''}</p><button className={features.vkSignIn?'':'primary'} disabled={busy} onClick={start}>{w.createPair}</button></>}</>;
  return <Card className="login-card"><span className="eyebrow">{t("OMOBA ACCOUNT")}</span>{failure?<p role="alert" className="notice error" data-signin-failure>{failure}</p>:null}
    {features.vkSignIn?<><h1>{t('Sign in to OMOBA')}</h1><p>{t('Use your VK, OK or Mail.ru account. The game confirms the first link to your profile.')}</p><VkSignInButtons returnTo={returnTo}/><SignInLegalNotice/>
      <div className="login-secondary" data-pairing><h2>{t('Or connect your game')}</h2><p>{w.pairingIntro}</p><Status error={error} busy={busy} w={w} retry={start}/>{pairing}</div></>
    :<><h1>{w.login}</h1><p>{w.pairingIntro}</p><Status error={error} busy={busy} w={w} retry={start}/>{pairing}<SignInLegalNotice/></>}
    <p className="muted separated">{w.newPlayer}</p><Link href="/download">{w.download} ↗</Link></Card>;
}

function FilterBar({w,stats=false}:{w:Words;stats?:boolean}){
  const { t } = useLocale();
  const params=useSearchParams(),router=useRouter(),path=usePathname();
  function update(key:string,value:string){const next=new URLSearchParams(params.toString());next.delete('cursor');if(value)next.set(key,value);else next.delete(key);router.replace(path+'?'+next);}
  return <div className="filters"><label>{w.period}<select value={params.get('days')||'30'} onChange={e=>update('days',e.target.value)}>{['7','30','90','all'].map(v=><option key={v} value={v}>{v==='all'?w.allTime:v+' '+w.days}</option>)}</select></label>
    <label>{w.hero}<select value={params.get('hero_class')||''} onChange={e=>update('hero_class',e.target.value)}><option value="">{w.all}</option>{['Warrior','Ranger','Mage','Cleric'].map(v=><option key={v} value={v.toLowerCase()}>{t(v)}</option>)}</select></label>
    <label>{w.matches}<select value={params.get('rated')||(stats?'true':'all')} onChange={e=>update('rated',e.target.value)}><option value="all">{w.all}</option><option value="true">{w.rated}</option><option value="false">{w.unrated}</option></select></label>
    {!stats?<label>{w.outcome}<select value={params.get('outcome')||''} onChange={e=>update('outcome',e.target.value)}><option value="">{w.all}</option><option value="win">{w.victory}</option><option value="loss">{w.defeat}</option><option value="interrupted">{w.interrupted}</option><option value="abandoned">{w.abandoned}</option></select></label>:null}</div>;
}
function query(params:URLSearchParams,stats=false){const q=new URLSearchParams(params);if(!q.has('days'))q.set('days','30');if(!q.has('rated'))q.set('rated',stats?'true':'all');return q.toString();}
function HistoryView({w,tz,locale,compact=false}:{w:Words;tz:string;locale:string;compact?:boolean}){
  const { t } = useLocale();
  const number=(value:Parameters<typeof formatNumber>[0])=>formatNumber(value,locale);
  const params=useSearchParams(),router=useRouter(),path=usePathname();const {data,error,busy,refresh}=useData<History>('me/matches?'+(compact?'limit=5&days=all':query(new URLSearchParams(params.toString()))));
  return <Card><div className="section-heading"><h2>{compact?w.latest:w.matches}</h2>{compact?<Link href="/me/matches">{w.allMatches} →</Link>:<button onClick={refresh}>{w.refresh}</button>}</div>{!compact?<FilterBar w={w}/>:null}<Status error={error} busy={busy} w={w} retry={refresh}/>
    {data?.matches.length===0?<Empty text={w.noMatches}/>:null}<div className="match-list">{data?.matches.map(m=><Link className={'match-row '+(m.won===true?'won':m.won===false?'lost':'neutral')} key={m.result_id} href={'/matches/'+encodeURIComponent(m.result_id)}>
      <ClassIcon name={m.hero_class}/><div><strong>{outcome(m.won,m.outcome,w)}</strong><small>{t(m.hero_class)} · {duration(m.duration_ms)}</small></div><div><b>{m.kills} / {m.deaths} / {m.assists}</b><small>K / D / A</small></div><div className="damage-cell"><b>{number(m.damage_to_heroes)}</b><small>{w.damage}</small></div><div className="match-end"><b>{m.rating?(m.rating.delta>0?'+':'')+m.rating.delta+' MMR':w.unrated}</b><small>{time(m.ended_at,tz,locale)}</small></div><span aria-hidden="true">↗</span></Link>)}</div>
    {data?.next_cursor&&!compact?<button className="separated" onClick={()=>{const q=new URLSearchParams(params);q.set('cursor',data.next_cursor!);router.push(path+'?'+q);}}>{w.next} →</button>:null}</Card>;
}

function MatchView({id,w,tz,locale,me}:{id:string;w:Words;tz:string;locale:string;me:string}) {
  const { t } = useLocale();
  const number=(value:Parameters<typeof formatNumber>[0])=>formatNumber(value,locale);
  const {data,error,busy,refresh}=useData<{match:Match}>('matches/'+encodeURIComponent(id));const m=data?.match;
  return <><Status error={error} busy={busy} w={w} retry={refresh}/>{m?<><div className="page-heading"><span className="eyebrow">{t("MATCH REPORT")}</span><h1>{outcome(m.winner===null?null:m.participants.some(p=>p.profile_id===me&&p.team===m.winner),m.outcome,w)}</h1><p>{time(m.ended_at,tz,locale)} · {duration(m.duration_ms)} · {m.rated?w.rated:w.unrated}</p></div>{!m.rated?<div className="notice">{w.noReward}{m.unrated_reason?' · '+m.unrated_reason:''}</div>:null}
    {Array.from(new Set(m.participants.map(p=>p.team))).map(team=><Card key={team}><h2>{w.team} {team} {m.winner===team?'· '+w.victory:''}</h2><div className="scoreboard">{m.participants.filter(p=>p.team===team).map(p=><details key={p.player_id} className={p.profile_id===me?'mine':''}><summary><ClassIcon name={p.hero_class}/><div><strong>{p.nickname}{p.is_bot?' · '+w.bot:''}</strong><small>{t(p.hero_class)} · {p.avatar||p.sprite_character||t('Default')}</small></div><b>{p.stats.kills} / {p.stats.deaths} / {p.stats.assists}</b><span>{number(p.stats.damage_to_heroes)} <small>{w.damage}</small></span></summary><div className="detail-grid">
    {([['structures','damage_to_structures'],['creeps','damage_to_creeps'],['taken','damage_taken'],['minions','minion_last_hits'],['jungle','jungle_last_hits'],['towers','structures_destroyed'],['finalLevel','final_level']] as const).map(([label,key])=><Metric key={key} label={w[label]} value={number(p.stats[key])}/>)}<Metric label="MMR" value={p.rating?(p.rating.delta>0?'+':'')+p.rating.delta:'—'}/><Metric label="XP" value={p.progression_xp_gained}/>{p.disconnected?<span>{w.disconnected}</span>:null}{p.profile_id?<Link href={'/players/'+p.profile_id}>{w.profile} ↗</Link>:null}</div></details>)}</div></Card>)}<p className="muted">{w.historical}</p></>:null}</>;
}

function StatsView({w,tz,locale}:{w:Words;tz:string;locale:string}){
  const { t } = useLocale();
  const number=(value:Parameters<typeof formatNumber>[0])=>formatNumber(value,locale);
  const params=useSearchParams();const {data,error,busy,refresh}=useData<Analytics>('me/statistics?'+query(new URLSearchParams(params.toString()),true));
  const points=data?.rating||[];const min=Math.min(...points.map(p=>p.after),1000)-20,max=Math.max(...points.map(p=>p.after),1000)+20;
  return <><div className="page-heading"><span className="eyebrow">{t("YOUR PROGRESS")}</span><h1>{w.stats}</h1></div><FilterBar w={w} stats/><Status error={error} busy={busy} w={w} retry={refresh}/>{data?<>
    {data.pending_results>0?<div className="notice">{w.updating} · {data.pending_results}</div>:null}
    <Card><div className="metrics"><Metric label={w.sample} value={data.summary.matches}/><Metric label={w.winRate} value={data.summary.win_rate==null?'—':number(data.summary.win_rate*100)+'%'}/><Metric label="KDA" value={number(data.summary.kda)}/><Metric label={w.dmgMinute} value={number(data.summary.damage_per_minute)} accent/></div><p className="muted">{w.kdaHelp}</p>{data.summary.matches<5?<p className="notice">{w.smallSample}</p>:null}</Card>
    <Card><h2>{w.ratingHistory}</h2>{data.rating_truncated?<p className="muted">{t('Showing the latest 1000 rating changes.')}</p>:null}{points.length?<><svg viewBox="0 0 640 180" role="img" aria-label={w.ratingHistory} className="rating-chart"><text x="0" y="15">{max}</text><text x="0" y="170">{min}</text><line x1="48" y1="160" x2="630" y2="160" stroke="currentColor" opacity=".2"/><polyline fill="none" stroke="var(--mint)" strokeWidth="3" points={points.map((p,i)=>`${48+i*570/Math.max(1,points.length-1)},${160-(p.after-min)*140/(max-min)}`).join(' ')}/>{points.map((p,i)=><circle key={p.result_id} cx={48+i*570/Math.max(1,points.length-1)} cy={160-(p.after-min)*140/(max-min)} r="3" fill="var(--mint)"/>)}</svg><details><summary>{w.ratingHistory} · {w.matches}</summary><ul>{points.map(p=><li key={p.result_id}><Link href={'/matches/'+p.result_id}>{time(p.ended_at,tz,locale)}</Link> · {p.before} → {p.after} ({p.delta>0?'+':''}{p.delta})</li>)}</ul></details></>:<Empty text={w.empty}/>}</Card>
    <Card><h2>{w.byClass}</h2>{data.classes.map(c=><div className="class-row" key={c.hero_class}><ClassIcon name={c.hero_class}/><strong>{t(c.hero_class)}</strong><span>{c.matches} {w.matches.toLowerCase()}</span><span>{c.win_rate==null?'—':number(c.win_rate*100)+'%'} · {w.winRate}</span><span>{number(c.kda)} KDA</span></div>)}</Card>{data.data_as_of?<p className="muted">{w.asOf} {time(data.data_as_of,tz,locale)}</p>:null}</>:null}</>;
}

function FriendsView({w}:{w:Words}){
  const { t } = useLocale();
  const[found,setFound]=useState<Profile|null>(null);
  const {data,error,busy,refresh}=useData<Friends>('me/friends');const[code,setCode]=useState(''),[actionError,setActionError]=useState<unknown>(null),[pending,setPending]=useState(false);
  async function act(id:string,action:string,etag?:string){setPending(true);setActionError(null);try{await api('me/friend-actions','POST',{target_profile_id:id,action,...(etag?{expected_etag:etag}:{})});refresh();}catch(e){setActionError(e);}finally{setPending(false);}}
  async function find(){setPending(true);setActionError(null);setFound(null);try{const result=await api<{players:Profile[]}>('players?query='+encodeURIComponent(code.trim()));if(!result.players.length)throw new ApiFailure('player_not_found',404);setFound(result.players[0]);}catch(e){setActionError(e);}finally{setPending(false);}}
  return <><h1>{w.friends}</h1><Card><form className="search" onSubmit={e=>{e.preventDefault();void find();}}><label>{w.friendSearchHelp}<input value={code} onChange={e=>{setCode(e.target.value);setFound(null);}} maxLength={45} placeholder={t("Nickname#1234")} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={pending}/></label><button className="primary" disabled={pending||!/^[^#]{1,20}#[0-9]{4}$/u.test(code.trim())}>{w.search}</button></form>{found?<div className="friend-row"><strong>{found.nickname}</strong><button disabled={pending} onClick={()=>void act(found.profile_id,'request')}>{w.addFriend}</button></div>:null}</Card><Status error={error||actionError} busy={busy} w={w} retry={refresh}/>
    {(['incoming','friends','outgoing'] as const).map(group=><Card key={group}><h2>{w[group]} <span className="count">{data?.[group].length??'—'}</span></h2>{data?.[group].length===0?<Empty text={w.empty}/>:null}{data?.[group].map(f=><div className="friend-row" key={f.profile.profile_id}><div className="avatar">{f.profile.nickname.slice(0,1)}</div><div className="grow"><Link href={'/players/'+f.profile.profile_id}><strong>{f.profile.nickname}</strong></Link><small>{group==='friends'?w[f.presence==='playing'?'playing':f.presence==='online'?'online':f.presence==='offline'?'offline':'unknown']:'…'}</small></div>{(group==='incoming'?['accept','reject']:group==='outgoing'?['cancel']:['remove']).map(action=><button key={action} disabled={pending} onClick={()=>void act(f.profile.profile_id,action,f.etag)}>{w[action as keyof Words]}</button>)}</div>)}</Card>)}</>;
}

function PlayersView({id,w,me}:{id?:string;w:Words;me?:string}){
  const { t } = useLocale();const { features } = useMarket();
  const[search,setSearch]=useState(''),[submitted,setSubmitted]=useState(''),[actionError,setActionError]=useState<unknown>(null),[sent,setSent]=useState(false);
  const {data,error,busy,refresh}=useData<{profile?:Profile;players?:Profile[];access?:string}>(id?'players/'+id:submitted?'players?query='+encodeURIComponent(submitted):null);
  return <><h1>{w.players}</h1>{!id?<Card><form className="search" onSubmit={e=>{e.preventDefault();setSubmitted(search.trim());}}><label>{w.searchHelp}<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={80}/></label><button className="primary" disabled={search.trim().length<2}>{w.search}</button></form></Card>:null}<Status error={error||actionError} busy={busy} w={w} retry={refresh}/>
    {data?.profile?<Card><span className="eyebrow">{data.access==='contact'?w.contacts:w.public}</span><h2>{data.profile.nickname}</h2>{features.supporter&&data.profile.supporter?<HeroRecognitionBadge recognition={data.profile.supporter}/>:null}{features.supporter?<p><Link href="/supporters">{t("Meet the supporters")}</Link></p>:null}{data.profile.rating!=null?<ProfileMetrics p={data.profile} w={w}/>:<p className="muted">{w.limitedStats}</p>}{me&&me!==data.profile.profile_id?<button disabled={sent} onClick={async()=>{try{await api('me/friend-actions','POST',{target_profile_id:data.profile!.profile_id,action:'request'});setSent(true);}catch(e){setActionError(e);}}}>{sent?w.outgoing:w.addFriend}</button>:null}</Card>:null}
    {data?.players?<Card>{data.players.length===0?<Empty text={w.empty}/>:data.players.map(p=><Link className="friend-row" href={'/players/'+p.profile_id} key={p.profile_id}><div className="avatar">{p.nickname.slice(0,1)}</div><strong>{p.nickname}</strong><span>↗</span></Link>)}</Card>:null}</>;
}

function SocialLink({account,w,update}:{account:Account;w:Words;update:()=>void}){
  const { t, locale } = useLocale();const methodLabel=useMethodLabel();
  const[error,setError]=useState<unknown>(null),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  // Older Account APIs omit `social`: treated as no linked account.
  const vk=(Array.isArray(account.social)?account.social:[]).find(entry=>entry.provider==='vk');
  async function unlink(){if(!window.confirm(t('Unlink this VK account? You can still sign in through the game.')))return;setBusy(true);setError(null);try{await api('me/social/vk','DELETE');setDone(true);update();}catch(e){setError(e);}finally{setBusy(false);}}
  return <Card><h2>VK ID</h2>{error instanceof ApiFailure&&error.code==='fresh_confirmation_required'?<p role="alert" className="notice">{t('Sign in again to confirm this action: it needs a sign-in within the last 10 minutes.')}</p>:<Status error={error} busy={busy} w={w} retry={()=>setError(null)}/>}
    {done?<p role="status" className="notice">{t('VK account unlinked.')}</p>:null}
    {vk?<div className="friend-row"><div className="grow"><strong>{methodLabel(vk.method)}</strong><small>{fill(t('Linked: {method} · {date}'),{method:methodLabel(vk.method),date:new Date(vk.linked_at).toLocaleDateString(locale,{timeZone:account.settings.timezone})})}</small></div><button disabled={busy} onClick={()=>void unlink()}>{t('Unlink VK')}</button></div>
      :<p className="muted">{t('No VK account is linked. Link one in the game: Profile → “Sign in with VK”.')}</p>}</Card>;
}

function SettingsView({account,w,update}:{account:Account;w:Words;update:()=>void}){
  const { t, locale } = useLocale();const { features } = useMarket();
  const[s,setS]=useState<Settings>(account.settings),[nickname,setNickname]=useState(account.profile.nickname),[error,setError]=useState<unknown>(null),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
  const sessions=useData<Sessions>('me/sessions');useEffect(()=>setS(account.settings),[account.settings]);
  async function save(path:string,body:unknown){setBusy(true);setError(null);setSaved(false);try{await api(path,'PATCH',body);setSaved(true);update();}catch(e){setError(e);}finally{setBusy(false);}}
  return <><h1>{w.settings}</h1><Status error={error} busy={busy} w={w} retry={update}/>{saved?<p role="status" className="notice">{w.saved}</p>:null}<Card><form onSubmit={e=>{e.preventDefault();void save('me/profile',{nickname});}}><label>{w.nickname}<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={45} pattern="[^#]{1,20}#[0-9]{4}" placeholder={t("Nickname#1234")} autoCapitalize="none" spellCheck={false}/><small>{w.handleHelp}</small></label><button disabled={busy}>{w.save}</button></form></Card>
    <Card><h2>{w.privacy}</h2><form onSubmit={e=>{e.preventDefault();void save('me/settings',{...s,expected_version:s.version,version:undefined});}}>{(['public_profile_enabled','public_stats_enabled','discoverable'] as const).map((key,i)=><label className="toggle" key={key}><input type="checkbox" checked={s[key]} disabled={i>0&&!s.public_profile_enabled} onChange={e=>setS({...s,[key]:e.target.checked,...(key==='public_profile_enabled'&&!e.target.checked?{public_stats_enabled:false,discoverable:false}:{})})}/>{[w.publicProfile,w.publicStats,w.discoverable][i]}</label>)}<p className="muted">{w.privacyHelp}</p><div className="filters"><label>{w.language}<LanguageSelector /></label><label>{w.timezone}<input value={s.timezone} onChange={e=>setS({...s,timezone:e.target.value})} list="timezones"/><datalist id="timezones">{['UTC','Europe/Moscow','Asia/Shanghai','Europe/Berlin','America/New_York'].map(v=><option key={v} value={v}/>)}</datalist></label></div><button disabled={busy} className="primary">{w.save}</button></form></Card>
    {features.vkSignIn?<SocialLink account={account} w={w} update={update}/>:null}<Card><h2>{w.sessions}</h2><p className="muted">{w.revokeHelp}</p><Status error={sessions.error} busy={sessions.busy} w={w} retry={sessions.refresh}/>{sessions.data?.sessions.map(session=><div className="friend-row" key={session.session_id}><div className="grow"><strong>{session.label}{session.current?' · '+w.currentSession:''}</strong><small>{new Date(session.last_seen).toLocaleString(locale,{timeZone:account.settings.timezone})}</small></div><button onClick={async()=>{try{await api('me/sessions/'+session.session_id,'DELETE');sessions.refresh();if(session.current)update();}catch(e){setError(e);}}}>{w.revoke}</button></div>)}</Card></>;
}
// Direct downloads only, sizes in MB and the status in the page language (LR-22); the
// game's update button opens `?platform=<its platform>`, which is listed first.
function Downloads({w}:{w:Words}){const{data,error,busy,refresh}=useData<unknown>('releases');const releases=data?pageReleases(data):null;const platform=useSearchParams().get('platform');return <><h1>{w.downloadsTitle}</h1><p>{w.downloadsHelp}</p><Status error={error} busy={busy} w={w} retry={refresh}/>{releases?.length===0?<Card><Empty text={w.noRelease}/></Card>:null}{releases?<ReleaseList releases={releases} platform={platform}/>:null}</>;}

/** `home`: the guest home's data, given only on `/` where the market's landing is this portal (LR-22). */
export default function Portal({initialAccount,initiallyUnavailable,accountDisabled=false,siteUrl=DEFAULT_SITE_URL,socialTicket:initialTicket=null,home=null}:{initialAccount:Account|null;initiallyUnavailable:boolean;accountDisabled?:boolean;siteUrl?:string;socialTicket?:SocialTicket|null;home?:GuestHomeData|null}){
  const[account,setAccount]=useState(initialAccount),[unavailable,setUnavailable]=useState(initiallyUnavailable);
  const[socialTicket,setSocialTicket]=useState(initialTicket),[signingOut,setSigningOut]=useState(false);
  const { features, landing, legal } = useMarket();
  const { locale, t } = useLocale();
  const number=(value:Parameters<typeof formatNumber>[0])=>formatNumber(value,locale);
  const path=usePathname();const router=useRouter();const w=dictionaries[locale],tz=account?.settings.timezone||'UTC';
  const reload=useCallback(async()=>{try{setAccount(await api<Account>('me'));setUnavailable(false);}catch(e){if(e instanceof ApiFailure&&e.status===401){setAccount(null);setUnavailable(false);}else setUnavailable(true);}},[]);
  const loginParams=useSearchParams();const returnTo=portalReturnTo(loginParams.get('returnTo'),features);
  const loginHref=portalLoginHref(path==='/login'?returnTo:path+(loginParams.size?'?'+loginParams.toString():''),features);
  // Sign-out also drops an unlinked VK ID ticket (the BFF clears both cookies).
  const signOut=useCallback(async()=>{setSigningOut(true);try{await api('auth/logout','POST',{});setAccount(null);setSocialTicket(null);router.push('/me');}catch{setUnavailable(true);}finally{setSigningOut(false);}},[router]);
  const signInLabel=features.vkSignIn?t('Sign in'):w.login;
  const connected=useCallback(()=>{void reload();router.push(returnTo);},[reload,router,returnTo]);
  useEffect(()=>{if(!account)return;const focus=()=>void reload();window.addEventListener('focus',focus);const timer=setInterval(focus,5000);return()=>{window.removeEventListener('focus',focus);clearInterval(timer);};},[Boolean(account),reload]);
  const titles:Record<string,string>={'/me':w.overview,'/me/matches':w.matches,'/me/stats':w.stats,'/players':w.players,'/friends':w.friends,'/creators':t('Creators'),'/market':t('Market'),'/sponsor':t('Community sculptures'),'/workshop':t('Workshop'),'/supporter':t('Hero'),'/supporters':t('Supporters'),'/devices':t('Devices'),'/settings':w.settings};
  // Only pages this market serves (no Ekza or Supporter pages in ru/cn).
  const nav=portalNav(PORTAL_NAV,features).map(href=>[href,titles[href]] as const);
  // Where `/` is the market's landing (LR-22) the brand leads there and no other website is linked.
  const ownLanding=landing.home==='portal',brandHref=ownLanding?'/':'/me';
  const experimental=(href:string)=>href==='/workshop'&&landing.workshop==='experimental'?<em className="nav-tag" data-experimental>{t('experimental')}</em>:null;
  const guestLinks=portalNav(GUEST_LINKS,features);
  let content:React.ReactNode;
  if (path === '/' && home && !account) content = <GuestHome home={home} loginHref={portalLoginHref('/me',features)} signInLabel={signInLabel}/>;
  else if (path === '/supporters' && features.supporter) content = <SupportersView accountDisabled={accountDisabled}/>;
  else if (accountDisabled)
    content = (
      <Card className="portal-welcome">
        <div className="portal-welcome-copy">
          <span className="eyebrow">{t("OMOBA · GUEST PROTOTYPE")}</span>
          <h1>
            {path === "/me/matches" || path.startsWith("/matches/") ? w.matches : t("Find your play.")}
          </h1>
          <p className="portal-guest-status" role="status">
            {t("Guest mode · browser drafts")}
          </p>
          <p>
            {features.ekza
              ? t("This site provides the asset library, class builder, browser drafts and JSON downloads. Sign-in, match history, account saves and Ekza connection are currently disabled.")
              : t("This site provides the class builder, browser drafts and JSON downloads. Sign-in, match history and account saves are currently disabled.")}
          </p>
          <Link className="button primary" href="/workshop">
            {t("Open class workshop")} →
          </Link>
          {guestLinks.includes("/creators") ? <Link className="button" href="/creators">{t("Asset library")}</Link> : null}
          {guestLinks.includes("/sponsor") ? <Link className="button" href="/sponsor">{t("Community sculptures")}</Link> : null}
          {guestLinks.includes("/market") ? <Link className="button" href="/market">{t("Market")}</Link> : null}
        </div>
        <figure className="portal-welcome-art">
          <img
            src="/art/supporter/spellblade.webp"
            alt={
              t("OMOBA spellblade illustration")
            }
            width={1024}
            height={1024}
          />
          <figcaption>
            {t("OMOBA concept art · not an in-game skin")}
          </figcaption>
        </figure>
      </Card>
    );
  else if(path==='/connect')content=<ConnectView signedIn={Boolean(account)} socialTicket={socialTicket}/>;
  // A confirmed but unlinked VK ID: finish registration in the game (public pages stay as they are).
  else if(!account&&socialTicket&&path!=='/download'&&!path.startsWith('/players/'))content=<RegistrationView ticket={socialTicket} busy={signingOut} onSignOut={()=>void signOut()}><Downloads w={w}/></RegistrationView>;
  else if(path==='/login')content=<Login w={w} onConnected={connected} returnTo={returnTo}/>;
  else if(path==='/download')content=<Downloads w={w}/>;
  else if(path.startsWith('/players/'))content=<PlayersView id={path.split('/')[2]} w={w} me={account?.profile.profile_id}/>;
  else if(!account)content=<><div className="hero"><span className="eyebrow">{t("OMOBA · PLAYER PORTAL")}</span><h1>{w.title}</h1><p>{w.intro}</p><Link className="button primary" href={loginHref}>{signInLabel} →</Link><Link className="button" href="/download">{w.download}</Link></div><div className="value-grid">{[[w.matches,w.historical],[w.stats,w.ratingHistory],[w.friends,w.friendCode]].map(([title,description])=><Card key={title}><h2>{title}</h2><p className="muted">{description}</p></Card>)}</div></>;
  else if(path==='/me/matches')content=<HistoryView w={w} tz={tz} locale={locale}/>;
  else if(path.startsWith('/matches/'))content=<MatchView id={path.split('/')[2]} me={account.profile.profile_id} w={w} tz={tz} locale={locale}/>;
  else if(path==='/me/stats')content=<StatsView w={w} tz={tz} locale={locale}/>;
  else if(path==='/friends')content=<FriendsView w={w}/>;
  else if(path==='/players')content=<PlayersView w={w} me={account.profile.profile_id}/>;
  else if(path==='/supporter'&&features.supporter)content=<SupporterView locale={locale} nickname={account.profile.nickname}/>;
  else if(path==='/devices')content=<DevicesView locale={locale} nickname={account.profile.nickname}/>;
  else if(path==='/settings')content=<SettingsView account={account} w={w} update={()=>void reload()}/>;
  else if(path==='/'||path==='/me')content=<><div className="page-heading"><span className="eyebrow">{w.account}</span><h1>{account.profile.nickname}<span className="dot">.</span></h1><p>{w.title}</p></div><Card><ProfileMetrics p={account.profile} w={w}/><div className="profile-strip"><span>{number(account.profile.rated_matches)} {w.ratedMatches.toLowerCase()}</span>{(account.profile.rated_matches||0)<account.rules.newcomer_matches?<span className="tag">{w.newcomer}</span>:null}<span>{number(account.profile.progression_xp)} XP</span></div></Card>{path==='/me'?<Card><h2>{w.friendCode}</h2><p className="code">{account.profile.nickname}</p><Copy value={account.profile.nickname} w={w}/><Link className="button" href="/settings">{w.settings}</Link>{features.supporter?<Link className="button" href="/supporter">✦ {t('Hero')}</Link>:null}<Link className="button" href="/devices">{t('Devices')}</Link></Card>:null}<HistoryView w={w} tz={tz} locale={locale} compact/></>;
  else content=<Card><Empty text={w.private}/></Card>;
  return <div className="shell"><aside className="sidebar"><Link href={brandHref} className="brand"><Brand section={t("Player portal")} /></Link><nav aria-label={t("Main")}>{nav.map(([href,title])=><Link key={href} href={href} className={path===href?'active':''}><NavIcon href={href}/>{title}{experimental(href)}</Link>)}</nav><div className="sidebar-bottom">{ownLanding?null:<a className="button" href={siteUrl}>{t('OMOBA website')} ↗</a>}<Link className="button" href="/download">{w.download} ↗</Link><small>{t("OPEN SOURCE · OPEN MOBA")}</small></div></aside><div className="workspace"><header className="topbar"><Link href={brandHref} className="portal-mobile-brand" aria-label={t("OMOBA player portal")}><Brand section={t("Player portal")} /></Link><span className="beta">BETA</span><span className="muted">{w.account}</span><div className="grow"/><LanguageSelector />{account?<><Link className="account-link" href="/me">{account.profile.nickname}</Link><button disabled={signingOut} onClick={()=>void signOut()}>{w.logout}</button></>:accountDisabled?<span className="muted">{t('Guest prototype')}</span>:socialTicket?<button disabled={signingOut} onClick={()=>void signOut()}>{w.logout}</button>:<Link href={loginHref}>{signInLabel}</Link>}</header><main>{unavailable&&!accountDisabled?<div role="alert" className="notice error">{w.unavailable} <button onClick={()=>void reload()}>{w.retry}</button></div>:null}{content}</main><footer>{ownLanding?<Link href="/">OMOBA</Link>:<a href={siteUrl}>OMOBA · {t('Website')} ↗</a>}<LegalLinks/>{legal.ageRating?<span className="age-sign" title={t('Age rating')} aria-label={t('Age rating')+' '+legal.ageRating} data-age-rating>{legal.ageRating}</span>:null}<span>2026</span></footer></div><nav className="mobile-nav" aria-label={t("Mobile")}>{nav.filter(([p])=>mobileNav(features,landing).includes(p)).map(([href,title])=><Link href={href} key={href} className={path===href?'active':''}><NavIcon href={href}/>{title}</Link>)}</nav></div>;
}
