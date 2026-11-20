'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brand } from './brand';
import { LanguageSelector, useLocale } from './locale-provider';
import { useMarket } from './market-profile';
import { LegalLinks } from './legal';
import { BROWSER_GAME_ENTRY, BROWSER_GAME_MANIFEST, browserGameMessage, validBrowserGameManifest } from '@/lib/browser-game.mjs';
import { portalLoginHref } from '@/lib/navigation.mjs';
import { playCopy } from '@/lib/play-copy';

type Phase = 'idle'|'checking'|'loading'|'running'|'failed'|'unavailable'|'unsupported';
export function BrowserPlay({displayName, socialName, accountDisabled, accountUnavailable, siteUrl}: {
  displayName:string|null; socialName:string|null; accountDisabled:boolean; accountUnavailable:boolean; siteUrl:string;
}) {
  const {locale} = useLocale(), w = playCopy(locale), {features} = useMarket();
  const [phase,setPhase] = useState<Phase>('idle'), [attempt,setAttempt] = useState(0);
  const [notice,setNotice] = useState('');
  const frame = useRef<HTMLIFrameElement>(null), arena = useRef<HTMLDivElement>(null);
  const preflight = useRef<AbortController|null>(null);
  const active = phase === 'loading' || phase === 'running';
  useEffect(()=>()=>preflight.current?.abort(),[]);
  useEffect(()=>{
    if (!active) return;
    const receive = (event:MessageEvent)=>{
      const status = browserGameMessage(event,frame.current?.contentWindow,location.origin);
      if (status === 'ready') setPhase('running');
      if (status === 'error') setPhase('failed');
    };
    window.addEventListener('message',receive);
    return ()=>window.removeEventListener('message',receive);
  },[active]);
  useEffect(()=>{
    if (phase !== 'loading') return;
    const timer = setTimeout(()=>setPhase('failed'),120000);
    return ()=>clearTimeout(timer);
  },[phase]);

  async function launch() {
    preflight.current?.abort();
    const controller = new AbortController(); preflight.current = controller;
    setNotice('');
    if (typeof WebAssembly === 'undefined') { setPhase('unsupported'); return; }
    setPhase('checking');
    const timer = setTimeout(()=>controller.abort(),15000);
    try {
      const response = await fetch(BROWSER_GAME_MANIFEST,{cache:'no-store',credentials:'omit',signal:controller.signal});
      if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) { setPhase('unavailable'); return; }
      if (!response.ok) throw new Error('artifact unavailable');
      if (!validBrowserGameManifest(await response.json())) throw new Error('invalid artifact');
      if (controller.signal.aborted) return;
      setAttempt(value=>value+1); setPhase('loading');
    } catch { if (preflight.current === controller) setPhase('failed'); }
    finally { clearTimeout(timer); }
  }
  function stop() { preflight.current?.abort(); preflight.current=null; setPhase('idle'); setNotice(''); }
  async function fullscreen() {
    try { await arena.current?.requestFullscreen(); }
    catch { setNotice(w.fullscreenFailed); }
  }
  const status = phase==='checking'?w.checking:phase==='loading'?w.loading:phase==='running'?w.ready:
    phase==='unavailable'?w.unavailable:phase==='unsupported'?w.unsupported:phase==='failed'?w.failed:'';
  const error = ['failed','unavailable','unsupported'].includes(phase);
  return <div className="browser-play">
    <a className="play-skip" href="#play-content">{w.start}</a>
    <header className="play-header">
      <Link href="/me" aria-label="OMOBA"><Brand section={w.section}/></Link>
      <nav aria-label={w.back}><Link href="/me">{w.back}</Link><Link href="/me/matches">{locale==='ru'?'Матчи':locale==='zh'?'比赛记录':'Matches'}</Link></nav>
      <div className="play-header-actions"><LanguageSelector/>{displayName?<Link className="play-account-link" href="/me">{displayName}</Link>:socialName?<span className="play-account-link">VK ID · {socialName}</span>:!accountDisabled?<Link className="play-account-link" href={portalLoginHref('/play',features)}>{features.vkSignIn?w.vkSignin:w.signin}</Link>:null}</div>
    </header>
    <main id="play-content">
      <section className="play-intro">
        <div><span className="eyebrow">{w.badge}</span><h1>{w.title}</h1><p>{w.intro}</p></div>
        <span className="play-mode"><span aria-hidden="true"/>{w.local}</span>
      </section>
      <div className="play-layout">
        <section className="play-arena-card" aria-label={w.frame}>
          <div className={'play-arena '+(active?'play-arena-active':'')} ref={arena} aria-busy={phase==='checking'||phase==='loading'}>
            {active?<iframe key={attempt} ref={frame} src={BROWSER_GAME_ENTRY} title={w.frame}
              allow="fullscreen; gamepad" sandbox="allow-scripts allow-same-origin allow-pointer-lock" allowFullScreen
              onError={()=>setPhase('failed')}/>:<div className="play-arena-cover">
              <div className="play-cover-emblem"><img src="/brand/omoba-logo.png" width="144" height="144" alt=""/></div>
              <span className="eyebrow">OMOBA</span><h2>{w.badge}</h2><p>{w.local}</p>
              <button className="primary" disabled={phase==='checking'} onClick={()=>void launch()}>{phase==='checking'?w.checking:error?w.retry:w.start}<span aria-hidden="true"> ↗</span></button>
            </div>}
            {phase==='loading'?<div className="play-loading" role="status"><span className="play-spinner"/>{w.loading}</div>:null}
          </div>
          <div className="play-arena-footer"><p>{w.progress}</p>{active?<div className="play-game-actions"><button onClick={()=>void fullscreen()}>{w.fullscreen}</button><button onClick={stop}>{w.exit}</button></div>:null}</div>
          {status&&phase!=='loading'?<p className={'play-status '+(error?'play-status-error':'')} role={error?'alert':'status'}>{status}</p>:null}
          {notice?<p className="play-status" role="status">{notice}</p>:null}
        </section>
        <aside className="play-side">
          <section className="play-info-card"><span className="eyebrow">{w.account}</span>
            {displayName?<><h2>{displayName}</h2><p>{w.signedIn}</p><Link className="play-text-link" href="/me">{w.profile} ↗</Link></>:socialName?<><h2>{socialName}</h2><p>{w.socialConfirmed}</p><Link className="play-text-link" href={portalLoginHref('/play',features)}>{w.linkProfile} ↗</Link></>:<><h2>{features.vkSignIn?w.vkSignin:w.signin}</h2><p>{accountDisabled?w.accountDisabled:accountUnavailable?w.accountUnavailable:w.accountIntro}</p>{!accountDisabled?<Link className="play-signin" href={portalLoginHref('/play',features)}>{features.vkSignIn?w.vkSignin:w.signin} ↗</Link>:null}</>}
          </section>
          <section className="play-info-card"><h2>{w.controls}</h2><dl className="play-controls">
            {[[w.movement,w.movementKeys],[w.aim,w.pointer],[w.attack,w.click],[w.skills,'Q W E R'],[w.classes,'1 - 7'],[w.dash,'F'],[w.recall,'B'],[w.pause,'Esc'],[w.rematch,'N']].map(([action,key])=><div key={action}><dt>{action}</dt><dd><kbd>{key}</kbd></dd></div>)}
          </dl></section>
          <section className="play-info-card play-online"><h2>{w.online}</h2><p>{w.onlineIntro}</p><Link className="play-text-link" href="/download">{w.getGame} ↗</Link></section>
        </aside>
      </div>
    </main>
    <footer className="play-footer"><a href={siteUrl}>{w.about} ↗</a><span>OMOBA · {new Date().getFullYear()}</span><LegalLinks/></footer>
  </div>;
}
