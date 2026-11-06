'use client';
import {useLocale} from '@/components/locale-provider';
import {useEffect,useRef,useState} from 'react';
import {rankedProgress,earnedSeasonBadge,rankedWords,rankedTransition,type RankedTransition} from '@/lib/ranked-seasons.mjs';
import type {Profile} from '@/lib/types';
import './ranked-season.css';
const fill=(template:string,values:Record<string,string>)=>template.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
function dateLabel(value:number,locale:string){
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(locale==='zh'?'zh-CN':locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date):'—';
}
export function RankedTag({p,total=20,className='tag'}:{p:Profile;total?:number;className?:string}){
  const {locale}=useLocale(),words=rankedWords(locale),progress=rankedProgress(p,total);
  if(!progress)return null;
  return <span className={className+' ranked-tag'} data-ranked-tier={progress.tier??'placement'} data-newcomer={!progress.calibrated||undefined} title={words.help}>
    {progress.tier?words[progress.tier]:fill(words.placement,{n:String(progress.played),total:String(progress.total)})}
  </span>;
}
export function RankedSeason({p}:{p:Profile}){
  const {locale}=useLocale(),words=rankedWords(locale),progress=rankedProgress(p),badge=earnedSeasonBadge(p);
  if(!progress)return null;
  return <div className="ranked-season" data-ranked-season>
    <div className="ranked-season-line"><RankedTag p={p}/>{progress.seasonId!=null?<><strong>{fill(words.season,{n:String(progress.seasonId)})}</strong><span className="muted">{fill(words.until,{date:dateLabel(progress.endsAt!,locale)})}</span></>:null}</div>
    {badge?<div className="season-earned" data-season-badge data-ranked-tier={badge.tier??'placement'}>
      <span aria-hidden="true">◆</span><span><strong>{fill(words.badge,{n:String(badge.seasonId)})}</strong><small>{badge.tier?words[badge.tier]:words.participation} · {badge.rating}</small></span>
    </div>:null}
  </div>;
}
export function RankedArchive({p}:{p:Profile}){
  const {locale}=useLocale(),words=rankedWords(locale);
  if(!rankedProgress(p)||!Array.isArray(p.ranked_archive))return null;
  return <section className="ranked-archive" data-ranked-archive><h3>{words.archive}</h3>
    {p.ranked_archive.length===0?<p className="muted">{words.emptyArchive}</p>:<ol>{p.ranked_archive.slice(0,10).map(season=><li key={season.season_id}>
      <div><strong>{fill(words.season,{n:String(season.season_id)})}</strong><span className="muted">{dateLabel(season.ends_at_ms,locale)}</span></div>
      <div><span>{words.finalRating}: <strong>{season.rating}</strong></span><span>{words.seasonMatches}: {season.rated_matches}</span><span>{words.record}: {season.wins} / {season.losses}</span></div>
      <small>{season.badge?season.badge.tier?words[season.badge.tier]??words.participation:words.participation:words.noBadge}</small>
    </li>)}</ol>}
  </section>;
}

/** Own account only. A new account/season remounts the baseline silently. */
export function RankedChangeNotice({p}:{p:Profile}){
  const progress=rankedProgress(p);
  if(!progress||progress.seasonId==null)return null;
  return <RankedChangeTracker key={p.profile_id+':'+progress.seasonId} p={p}/>;
}
function RankedChangeTracker({p}:{p:Profile}){
  const {locale}=useLocale(),words=rankedWords(locale),previous=useRef(p);
  const [notice,setNotice]=useState<RankedTransition|null>(null);
  useEffect(()=>{
    const old=rankedProgress(previous.current),next=rankedProgress(p);
    if(!old||!next||next.played<=old.played)return;
    const event=rankedTransition(previous.current,p);
    previous.current=p;
    setNotice(event);
  },[p]);
  return notice?<div className="notice ranked-change" role="status" aria-live="polite" data-ranked-notice={notice.kind}>
    <strong>{fill(words[notice.kind],{tier:words[notice.tier]})}</strong>
    <button type="button" onClick={()=>setNotice(null)} aria-label={words.dismissNotice}>×</button>
  </div>:null;
}
