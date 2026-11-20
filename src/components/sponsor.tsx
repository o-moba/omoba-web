'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Brand } from './brand';
import { LanguageSelector, useLocale } from './locale-provider';
import MarketPreviewDialog from './market-preview-dialog';
import { devicePollRetry } from '@/lib/market.mjs';
import type { EkzaDevice } from '@/lib/market-types';
import type { OwnPlacement, PlacementRequest, Sculpture, SponsorSession, SponsorState } from '@/lib/sponsor-types';

class Failure extends Error {
  constructor(public code: string, public retryAfter: number | null = null) { super(code); }
}
async function sponsor<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const csrf = await fetch('/api/sponsor/csrf', { cache: 'no-store' }).catch(() => null);
    if (!csrf?.ok) throw new Failure('registry_unavailable');
    headers['X-CSRF-Token'] = (await csrf.json()).token;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/sponsor/' + path, { method, headers, cache: 'no-store', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }).catch(() => null);
  if (!response) throw new Failure('registry_unavailable');
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    throw new Failure(value.code || 'registry_unavailable', retry && /^\d{1,4}$/.test(retry) ? Number(retry) : null);
  }
  return value;
}
const errors: Record<string, string> = {
  link_expired: 'Your placement sign-in expired. Connect again to manage your requests.',
  link_scope: 'Allow sculpture placement in Ekza Studio. A market sign-in does not grant this permission.',
  device_expired: 'The sign-in code expired. Start again.',
  asset_not_available: 'This exact model is no longer approved. Refresh and select an available sculpture.',
  slot_not_found: 'This location is no longer available. Refresh the page.',
  slot_occupied: 'The location is occupied. Your request can start only after it becomes available.',
  placement_limit: 'You already have a pending or active sculpture. Cancel it or wait for it to finish.',
  idempotency_conflict: 'This submission changed while being sent. Refresh before submitting again.',
  placement_not_found: 'This request no longer exists. Refresh your requests.',
  placement_decided: 'This request has already been decided. Refresh your requests.',
  invalid_request: 'Check the title, credit, description and rights confirmation before submitting.',
  csrf_rejected: 'This page is out of date. Reload it and try again.',
  rate_limited: 'Too many requests. Please wait a moment and try again.',
  placements_unsupported: 'Sculpture placement is not enabled on this server yet.',
};
const failureText = (error: unknown) => errors[error instanceof Failure ? error.code : ''] || 'The sculpture service is unavailable. Refresh or try again later.';
const statusText: Record<OwnPlacement['status'], string> = {
  pending: 'Waiting for review', active: 'Active on the map', expired: 'Placement finished',
  rejected: 'Declined', cancelled: 'Cancelled', revoked: 'Removed by administrator',
};
const initialCredit = (model: Sculpture | undefined) => (model?.license.attribution || model?.creator || '').replace(/\s+/g, ' ').slice(0, 120);

export default function Sponsor({ initialData, initialSession, uploadUrl, siteUrl }: {
  initialData: SponsorState; initialSession: SponsorSession; uploadUrl: string | null; siteUrl: string;
}) {
  const { t, locale } = useLocale();
  const [data, setData] = useState(initialData);
  const [session, setSession] = useState(initialSession);
  const [device, setDevice] = useState<EkzaDevice | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<Sculpture | null>(null);
  const first = initialData.state === 'ready' ? initialData.models[0] : undefined;
  const [modelId, setModelId] = useState(first?.id ?? '');
  const [slotId, setSlotId] = useState('opposite-dragon');
  const [title, setTitle] = useState(first?.name.slice(0, 80) ?? '');
  const [credit, setCredit] = useState(initialCredit(first));
  const [description, setDescription] = useState('');
  const descriptionLength = Array.from(description).length;
  const [rights, setRights] = useState(false);
  // The same exact payload keeps its key across a network failure or lost response.
  const submission = useRef<PlacementRequest | null>(null);
  const generation = useRef(0);
  const mutating = useRef(false);
  const models = data.state === 'ready' ? data.models : [];
  const model = models.find(item => item.id === modelId);
  const slot = data.state === 'ready' ? data.slots.find(item => item.id === slotId) : undefined;
  const connected = session.state === 'connected';
  const hasLive = session.state === 'connected' && session.items.some(item => item.status === 'pending' || item.status === 'active');
  const date = (value: string) => new Date(value).toLocaleString(locale, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC';
  useEffect(() => {
    // A refreshed catalog may replace a rendition under the same asset ID.
    // Never carry the prior version's attestation or open preview across it.
    setRights(false); setPreview(null); submission.current = null;
  }, [model?.id, model?.revisionId, model?.sha256]);

  const fail = useCallback((failure: unknown) => {
    setError(failureText(failure));
    if (failure instanceof Failure && ['link_scope', 'link_expired'].includes(failure.code)) setSession({ state: 'expired' });
  }, []);
  const refresh = useCallback(async (privateRead: boolean) => {
    const version = ++generation.current;
    const [publicResult, ownResult] = await Promise.allSettled([
      sponsor<SponsorState>('public'), privateRead ? sponsor<{ items: OwnPlacement[] }>('placements') : Promise.resolve(null),
    ]);
    if (generation.current !== version || mutating.current) return;
    if (publicResult.status === 'fulfilled') setData(publicResult.value);
    else { setData({ state: 'unavailable' }); fail(publicResult.reason); }
    if (ownResult.status === 'fulfilled' && ownResult.value) setSession({ state: 'connected', items: ownResult.value.items });
    else if (ownResult.status === 'rejected') fail(ownResult.reason);
  }, [fail]);
  useEffect(() => {
    // Expired server-rendered cookies are cleared by the BFF on this read.
    if (initialSession.state === 'expired') void sponsor('placements').catch(() => {});
  }, [initialSession.state]);
  useEffect(() => {
    const tick = () => { if (!mutating.current && !document.hidden) void refresh(connected); };
    const timer = setInterval(tick, 30000);
    return () => { clearInterval(timer); generation.current++; };
  }, [connected, refresh]);
  useEffect(() => {
    if (!device) return;
    let stopped = false, failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (Date.now() >= Date.parse(device.expiresAt)) { setDevice(null); fail(new Failure('device_expired')); return; }
      let delay = device.interval;
      try {
        const result = await sponsor<{ status: string }>('device/poll', 'POST');
        if (stopped) return;
        failures = 0; setRetrying(false);
        if (result.status === 'connected') { setDevice(null); await refresh(true); return; }
      } catch (failure) {
        if (stopped) return;
        const retry = failure instanceof Failure ? devicePollRetry(failure.code, ++failures, device.interval, failure.retryAfter) : null;
        if (retry === null) { setDevice(null); fail(failure); return; }
        delay = retry; setRetrying(true);
      }
      if (!stopped) timer = setTimeout(() => void poll(), delay * 1000);
    };
    timer = setTimeout(() => void poll(), device.interval * 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [device, fail, refresh]);

  async function act(action: () => Promise<void>) {
    if (mutating.current) return;
    mutating.current = true; generation.current++; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (failure) { fail(failure); }
    finally { mutating.current = false; setBusy(false); }
  }
  async function signIn() {
    await act(async () => { setDevice(await sponsor<EkzaDevice>('device', 'POST')); setRetrying(false); });
  }
  async function signOut() {
    await act(async () => {
      const result = await sponsor<{ revoked: boolean | null }>('sign-out', 'POST');
      setDevice(null); setSession({ state: 'guest' });
      if (result.revoked === false) setNotice('Signed out here. To disconnect the remaining link, open Account → Connected games in Ekza Studio.');
    });
  }
  function choose(value: string) {
    const next = models.find(item => item.id === value);
    setModelId(value); setTitle(next?.name.slice(0, 80) ?? '');
    setCredit(initialCredit(next)); setDescription('');
    setRights(false); submission.current = null;
  }
  async function create() {
    if (!model || !slot || !rights || !connected || descriptionLength > 1000) return;
    await act(async () => {
      const fields = { project: 'omoba' as const, slotId: slot.id, assetId: model.id, revisionId: model.revisionId, renditionSha256: model.sha256, title: title.trim(), credit: credit.trim(), description, rightsAccepted: true as const };
      const previous = submission.current;
      const { idempotencyKey: _previousKey, ...oldFields } = previous ?? {};
      const payload: PlacementRequest = { ...fields, idempotencyKey: previous && JSON.stringify(oldFields) === JSON.stringify(fields) ? previous.idempotencyKey : crypto.randomUUID() };
      submission.current = payload;
      const result = await sponsor<OwnPlacement>('placements', 'POST', payload);
      setSession(current => ({ state: 'connected', items: [result, ...(current.state === 'connected' ? current.items.filter(item => item.id !== result.id) : [])] }));
      setRights(false); submission.current = null; setNotice('Request submitted. An administrator will review the exact model, title, credit and description. Your day starts only after approval.');
    });
  }
  async function cancel(id: string) {
    await act(async () => {
      const result = await sponsor<OwnPlacement>('placements/' + id + '/cancel', 'POST');
      setSession(current => current.state === 'connected' ? { ...current, items: current.items.map(item => item.id === id ? result : item) } : current);
      setNotice('Placement cancelled. It will no longer be advertised to game clients.');
    });
    void refresh(connected);
  }
  return <div className="creator-page market-page sponsor-page">
    {preview && <MarketPreviewDialog item={preview} onClose={() => setPreview(null)} />}
    <a className="creator-skip" href="#sponsor-content">{t('Skip to sculptures')}</a>
    <header className="creator-header">
      <Link href="/sponsor" className="creator-brand"><Brand section={t('Community sculptures')} /></Link>
      <nav aria-label={t('Sculpture navigation')}><Link href="/market">{t('Market')}</Link><Link href="/creators">{t('Creators')}</Link><Link href="/me">{t('Player portal')}</Link><a href={siteUrl}>{t('About the game ↗')}</a></nav>
      <LanguageSelector />
    </header>
    <main id="sponsor-content">
      <section className="market-hero">
        <div><span className="creator-overline">{t('COMMUNITY SCULPTURES · FREE PILOT')}</span><h1>{t('Leave a little luck on the map')}<span>.</span></h1>
          <p>{t('Choose a community sculpture for the location opposite the dragon. Every model and placement is reviewed. Your sculpture stays for 24 hours after an administrator activates it.')}</p>
          <p>{t('Decoration only: no collision, combat bonus or change to the Wendigo objective.')}</p>
        </div>
        <aside className="market-account" aria-label={t('Placement account')}>
          <span className="creator-overline">{t('PLACEMENT PERMISSION')}</span>
          {device ? <><h2>{t('Approve in Ekza Studio')}</h2><p>{t('Confirm the sculpture placement permission for this code:')}</p><strong className="market-code">{device.userCode}</strong>
            {device.verificationUrl ? <a className="creator-primary" href={device.verificationUrl} target="_blank" rel="noreferrer">{t('Open Ekza Studio ↗')}</a> : <p>{t('Verification link is unavailable or not trusted.')}</p>}
            <p role="status">{t(retrying ? 'Ekza is not answering. Still trying…' : 'This page updates after you approve.')}</p><button disabled={busy} onClick={() => void signOut()}>{t('Cancel')}</button></>
            : connected ? <><h2>{t('Ready to submit')}</h2><p>{t('Your separate Ekza connection can submit and cancel your sculpture placements.')}</p><button disabled={busy} onClick={() => void signOut()}>{t('Disconnect placement permission')}</button></>
            : <><h2>{t('Connect with Ekza')}</h2><p>{t('Approve a separate placement permission in Studio. Your market and game sign-ins stay separate.')}</p><button className="market-get" disabled={busy} onClick={() => void signIn()}>{t('Connect for sculpture placement')}</button></>}
        </aside>
      </section>
      {error && <p className="sponsor-notice sponsor-error" role="alert">{t(error)}</p>}
      {notice && <p className="sponsor-notice" role="status">{t(notice)}</p>}
      <div className="sponsor-section-heading"><h2>{t('Plan your placement')}</h2><button disabled={busy} onClick={() => { setError(''); setNotice(''); void refresh(connected || session.state === 'unavailable'); }}>{t('Refresh')}</button></div>
      {data.state === 'unavailable' ? <p className="sponsor-notice">{t('The sculpture service is unavailable. Refresh or try again later.')}</p> : <form className="sponsor-plan" onSubmit={event => { event.preventDefault(); void create(); }}>
        <section className="sponsor-panel"><span className="creator-overline">{t('01 · LOCATION')}</span>
          <label>{t('Map location')}<select value={slotId} onChange={event => { setSlotId(event.target.value); setRights(false); }} disabled={busy}>{data.slots.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <div className="sponsor-map" role="img" aria-label={t('Fixed sculpture location beside the Wendigo pit, opposite the dragon')}><span className="sponsor-dragon">{t('Dragon')}</span><span className="sponsor-river" /><span className="sponsor-pit">{t('Wendigo')}</span><span className="sponsor-marker">✦<b>{t('Sculpture')}</b></span></div>
          <p className="market-small">{t('Location sketch. The game controls the exact position and size.')}</p>
          <dl className="sponsor-facts"><div><dt>{t('Duration')}</dt><dd>{t('24 hours after approval')}</dd></div><div><dt>{t('Price')}</dt><dd>{t('Free during the pilot')}</dd></div></dl>
          {!slot?.enabled && <p className="sponsor-notice">{t('This location is currently closed to requests.')}</p>}
          {slot?.current ? <p className="sponsor-notice">{t('Currently on the map:')} <strong>{slot.current.title}</strong><br />{t('Available after')} {date(slot.current.expiresAt!)}<br />{t('You may submit for review; an occupied location must become free before activation.')}</p> : <p className="sponsor-notice">{t('Location available. Activation still requires administrator approval.')}</p>}
        </section>
        <section className="sponsor-panel"><span className="creator-overline">{t('02 · SCULPTURE')}</span>
          <label>{t('Approved model')}<select value={modelId} onChange={event => choose(event.target.value)} disabled={busy || !models.length}><option value="">{t('Select a sculpture')}</option>{models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {model ? <><div className="sponsor-model-poster">{model.thumbnailUrl ? <img src={model.thumbnailUrl} alt={model.name} width={640} height={480} /> : <span aria-hidden="true">✦</span>}<button type="button" onClick={() => setPreview(model)}>{t('View in 3D')}</button></div><p className="market-small">{model.creator} · {model.license.text}<br />{model.license.attribution}</p></> : <p className="sponsor-notice">{t('No approved sculpture selected. Upload yours in Studio and request OMOBA approval first.')}</p>}
          <p className="market-small">{t('GLB up to 8 MiB. The pilot supports one looping rotation animation up to 30 seconds (LINEAR or STEP). Textures, skeletal rigs and morph animations are not supported yet.')}</p>
          {uploadUrl && <a className="sponsor-upload" href={uploadUrl} target="_blank" rel="noreferrer">{t('Create a sculpture in Ekza Studio ↗')}</a>}
        </section>
        <section className="sponsor-panel sponsor-submit"><span className="creator-overline">{t('03 · REVIEW')}</span>
          <label>{t('Placement title')}<input value={title} maxLength={80} required disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
          <label>{t('Credit')}<input value={credit} maxLength={120} required disabled={busy} onChange={event => setCredit(event.target.value)} /></label>
          <div className="sponsor-description-field"><label htmlFor="sculpture-description">{t('Description (optional)')}</label><textarea id="sculpture-description" value={description} rows={6} disabled={busy} aria-describedby="sculpture-description-help sculpture-description-count" onChange={event => { setDescription(event.target.value); setRights(false); }} /></div>
          <p id="sculpture-description-help" className="market-small">{t('Players can click your sculpture to read this text. Plain text only; links are not clickable. The description is reviewed with your model.')}</p>
          <p id="sculpture-description-count" className={descriptionLength > 1000 ? 'sponsor-notice sponsor-error' : 'market-small'} aria-live="polite">{descriptionLength} / 1000 · {t('characters')}{descriptionLength > 1000 && <> — {t('Shorten the description before submitting.')}</>}</p>
          <label className="sponsor-rights"><input type="checkbox" checked={rights} disabled={busy} onChange={event => setRights(event.target.checked)} required /><span>{t('I have the rights to display this model and its text. The model and text contain no obscene, hateful or misleading content.')}</span></label>
          <p className="market-small">{t('A human administrator reviews this exact version and text. Approval of the model alone does not activate a placement. Requests can be declined or removed.')}</p>
          {hasLive && <p className="sponsor-notice">{t('You already have a pending or active sculpture. Cancel it or wait for it to finish.')}</p>}
          <button className="market-get" disabled={busy || !connected || !model || !slot?.enabled || !rights || !title.trim() || !credit.trim() || descriptionLength > 1000 || hasLive}>{t('Submit free placement')}</button>
          {!connected && <p className="market-small">{t('Connect with Ekza above before submitting.')}</p>}
        </section>
      </form>}
      {session.state === 'connected' && <section className="sponsor-history"><h2>{t('Your placements')}</h2>{session.items.length === 0 ? <p>{t('No requests yet. Your submissions and review decisions will appear here.')}</p> : session.items.map(item => <article className="sponsor-request" key={item.id}>
        <div><span className={'sponsor-status sponsor-status-' + item.status}>{t(statusText[item.status])}</span><h3>{item.title}</h3><p>{item.credit}</p>{item.description && <p className="sponsor-description">{item.description}</p>}{item.startsAt && item.expiresAt ? <p className="market-small">{date(item.startsAt)} — {date(item.expiresAt)}</p> : <p className="market-small">{t('Your 24 hours have not started.')}</p>}
          {item.reason && <p className="sponsor-notice">{t('Review note:')} {item.reason}</p>}
        </div>{['pending', 'active'].includes(item.status) && <button disabled={busy} onClick={() => void cancel(item.id)}>{t('Cancel placement')}</button>}
      </article>)}</section>}
      <section className="sponsor-future"><span className="creator-overline">{t('SUPPORT THE PROJECT')}</span><h2>{t('Free to try. Built for community support.')}</h2><p>{t('Crypto payments are not enabled. This pilot does not ask for a wallet or transfer. Future paid placements will require server-verified payment as well as content approval.')}</p></section>
    </main>
    <footer className="sponsor-footer"><Link href="/market">{t('Community market')} →</Link><a href={siteUrl}>OMOBA ↗</a></footer>
  </div>;
}
