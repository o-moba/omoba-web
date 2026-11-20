'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api, accountError } from '@/lib/client-api';
import { useLocale } from '@/components/locale-provider';
import type { Locale } from '@/lib/i18n';
import type { SupporterRecognition } from '@/lib/types';

type Aura = 'solar' | 'lunar' | 'verdant';
type Grant = { provider: string; valid_from: number; valid_until: number; revoked: boolean; renewal_enabled: boolean | null };
type Status = { active: boolean; equipped_aura: Aura | null; active_until: number | null; grants: Grant[] };
type Membership = { recognition?: SupporterRecognition; supporter: Status; solana: { available: boolean; amount?: string; asset?: string; duration_days?: number; network?: string }; apple: { available: boolean; product_id?: string } };
type Order = { order_id: string; payment_url: string; amount: string; asset: string; network: string; expires_at: number; status?: 'pending' | 'confirmed'; confirmed_signature?: string | null };
const styles: Aura[] = ['solar', 'lunar', 'verdant'];

export default function SupporterView({ locale, nickname }: { locale: Locale; nickname: string }) {
  const { t } = useLocale();
  const [data, setData] = useState<Membership | null>(null), [aura, setAura] = useState<Aura>('solar');
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null), [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { let live = true; api<Membership>('me/supporter').then(v => { if (live) { setData(v); if (v.supporter.equipped_aura) setAura(v.supporter.equipped_aura); } }).catch(e => { if (live) setError(accountError(e, false)); }); return () => { live = false; }; }, []);
  useEffect(() => { let live = true; api<{orders:Order[]}>('me/supporter/solana/orders').then(v => { if(live) setOrders(v.orders); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function act(job: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await job(); } catch (e) { setError(accountError(e, false)); } finally { setBusy(false); } }
  const active = Boolean(data?.supporter.active && data.supporter.active_until && data.supporter.active_until * 1000 > now);
  const expiry = order ? order.expires_at * 1000 : 0, orderExpired = Boolean(order && (!Number.isFinite(expiry) || expiry <= now));
  const date = (seconds: number) => new Date(seconds * 1000).toLocaleString(locale);
  return <>
    <div className="page-heading"><span className="eyebrow">{t('MONTHLY SUPPORT · HERO')}</span><h1>{t("Let your hero shine.")}</h1><p>{t("Support OMOBA voluntarily. Each paid month brings a cosmetic Hero aura.")}</p></div>
    {error && <p role="alert" className="notice error">{t(error)}</p>}{message && <p role="status" className="notice">{t(message)}</p>}
    <div className="supporter-grid"><section className={'card aura-preview ' + aura} aria-label={t("Stylized aura preview")}>
      <span className="preview-label">{t("PREVIEW")}</span>
      <div className="aura-stage">
        <Image className="aura-hero" src="/art/supporter/spellblade.webp" width={1024} height={1024}
          sizes="(max-width: 760px) calc(100vw - 70px), (max-width: 1100px) 440px, 40vw"
          preload alt={t("Silver-armored hero with a sword and a glowing blue aura")} />
        <div className="aura-halo" aria-hidden="true" />
      </div>
      <strong>{nickname}</strong><span className="supporter-badge">✦ {t('Hero preview')}</span><p className="muted">{t("Effect illustration. In the game, the aura follows your character.")}</p>
    </section><section className="card"><span className={'tag ' + (active ? 'accent' : '')}>{active ? t("Hero active") : t("Free account")}</span><h2>{t("Your color")}</h2><div className="aura-choices" role="group" aria-label={t("Aura color")}>{styles.map(style => <button key={style} className={'aura-choice ' + style} aria-pressed={aura === style} onClick={() => setAura(style)}><span/>{style === 'solar' ? t("Solar") : style === 'lunar' ? t("Lunar") : t("Verdant")}</button>)}</div>
      <p>{t("Hero follows your account on phone and PC. It changes your appearance only: stats, rating and matchmaking stay equal for everyone.")}</p>
      <button className="primary" disabled={!active || busy} onClick={() => void act(async () => { await api('me/supporter/aura', 'PATCH', { aura }); setData(await api<Membership>('me/supporter')); setMessage("Aura selected. The game will receive the server update."); })}>{t("Equip in game")}</button>
      {active && <button disabled={busy} onClick={() => void act(async () => { await api('me/supporter/aura', 'PATCH', { aura: null }); setData(await api<Membership>('me/supporter')); setMessage("Aura hidden. Your Hero access remains active."); })}>{t("Hide aura")}</button>}
      {active && data?.supporter.active_until && <p className="muted">{t("Access until")} {date(data.supporter.active_until)}</p>}
      <p><Link href="/devices">{t("Devices and account recovery")} →</Link></p>
    </section></div>
    {data?.recognition && <section className="card recognition-settings">
      <div className="section-heading"><h2>{t("Public recognition")}</h2><span className="supporter-months"><strong>{data.recognition.months_supported.toLocaleString(locale)}</strong> {t("Months supported")}</span></div>
      <p>{t("One month is one verified paid period. Expired months remain counted; refunded periods do not.")}</p>
      <label className="toggle"><input type="checkbox" checked={data.recognition.visible} disabled={busy} onChange={event => {
        const visible = event.target.checked;
        void act(async () => {
          const recognition = await api<SupporterRecognition>('me/supporter/recognition', 'PATCH', { visible });
          setData(current => current ? { ...current, recognition } : current);
          setMessage("Recognition preference saved.");
        });
      }} />{t("Show my name and supported months in the public directory")}</label>
      <p className="muted">{t("This is optional. Your profile must also be public; statistics keep their own privacy setting.")}</p>
      {!data.recognition.public_profile_enabled && <p className="notice">{t("Your profile is private, so you are not listed. You can review profile visibility in Settings.")}</p>}
      {data.recognition.public_profile_enabled && data.recognition.visible && data.recognition.months_supported === 0 && <p className="muted">{t("You will appear after your first verified paid month.")}</p>}
      <div className="supporter-links"><Link className="button" href="/supporters">{t("Meet the supporters")} →</Link><Link className="button" href="/settings">{t("Profile visibility")}</Link></div>
    </section>}
    <section className="card"><h2>{t("Support development")}</h2><p>{t("Use this account on all your devices to share one purchase. Save your recovery codes before paying.")}</p>
      {!data && !error && <p role="status">{t("Loading payment options…")}</p>}
      {data && !data.solana.available && <p className="notice">{t("Website checkout is not available yet. You can preview the styles for free.")}</p>}
      {data?.solana.available && !order && <><p><strong>{data.solana.amount} {data.solana.asset}</strong> · {data.solana.duration_days} {t("days")} · {data.solana.network}</p><p className="muted">{t("Prepaid access, without automatic renewal. Your wallet shows network fees.")}</p><button className="primary" disabled={busy || active} onClick={() => void act(async () => { setOrder(await api<Order>('me/supporter/solana/checkout', 'POST', {})); setSignature(''); })}>{active ? t("Access already paid") : t("Pay with Solana")}</button></>}
      {!order && orders.some(o=>o.status==='pending') && <details><summary>{t("Already paid? Find your order")}</summary><p className="muted">{t("Orders from the last 7 days. Select the order you paid and verify its transaction.")}</p>{orders.filter(o=>o.status==='pending').map(o=><div className="friend-row" key={o.order_id}><span className="grow">{o.amount} {o.asset} · {new Date(o.expires_at*1000).toLocaleString(locale)}</span><button onClick={()=>{setOrder(o);setSignature('');}}>{t("Check this order")}</button></div>)}</details>}
      {order && <div className="device-confirm"><h3>{t("Payment for")} {nickname}</h3><p>{order.amount} {order.asset} · {order.network}</p>{order.network==='devnet'&&<p className="notice">{t("Test network: switch your wallet to Solana Devnet before paying. Real funds are not required.")}</p>}<p className="muted">{t("Expires at")} {new Date(expiry).toLocaleString(locale)}</p>{orderExpired ? <p className="notice">{t("The payment window expired. If you already paid, verify your transaction below; do not pay again.")}</p> : order.payment_url.startsWith('solana:') && <a className="button primary" href={order.payment_url}>{t("Open wallet")} ↗</a>}<form onSubmit={e => { e.preventDefault(); void act(async () => { await api('me/supporter/solana/confirm', 'POST', { order_id: order.order_id, signature: signature.trim() }); setOrder(null); setSignature(''); setData(await api<Membership>('me/supporter')); setMessage("Payment confirmed. Choose and equip your aura."); }); }}><label>{t("Transaction signature (optional)")}<input value={signature} onChange={e => setSignature(e.target.value)} maxLength={100} autoComplete="off" spellCheck={false} /></label><button disabled={busy}>{t("Verify payment")}</button></form><p className="muted">{t("Do not send another payment while your first transaction is confirming.")}</p></div>}
      <p className="muted">{t("Solana supports one 30-day period at a time. You choose whether to support again after it ends.")}</p>
      <p>{t("On iPhone, purchase and restore are available inside the game through the App Store when enabled for the current build.")}</p>
    </section>
    {data && data.supporter.grants.length > 0 && <section className="card"><h2>{t("Your access")}</h2>{data.supporter.grants.map((grant, i) => <div className="friend-row" key={i}><div className="grow"><strong>{grant.provider === 'apple' ? 'App Store' : grant.provider === 'solana' ? 'Solana' : grant.provider}</strong><small>{date(grant.valid_from)} — {date(grant.valid_until)}</small></div><span className="tag">{grant.revoked ? t("Revoked") : grant.valid_until * 1000 <= now ? t("Expired") : grant.renewal_enabled === null ? t("Check renewal in App Store") : grant.renewal_enabled ? t("Auto-renewal") : t("No auto-renewal")}</span></div>)}<p className="muted">{t("Manage an App Store subscription in Apple ID settings. Cancelling renewal preserves the paid period; a refund may end access.")}</p></section>}
  </>;
}
