'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiFailure } from '@/lib/client-api';
import { useLocale } from '@/components/locale-provider';
import { useMarket } from '@/components/market-profile';
import { AURA_STYLES, BASE_STYLES, GRANT_DAYS, MAX_RUB, MIN_RUB, TIERS, auraName, formatRubles, parseRubles, quoteFor, receiptEmail, styleUnlocked, tierFor, tierSteps, type Grant, type Tier } from '@/lib/hero-tiers.mjs';
import type { SupporterRecognition } from '@/lib/types';

// The Supporter page of a market that sells Hero tiers through YooKassa (LR-67, RU):
// the tier cards and their prices (readable without sign-in), a custom amount, the
// receipt e-mail, the offer, the redirect to YooKassa and the return state; for a
// signed-in player also the current tier with its step-down, the aura choice, the
// payment history and public recognition. Points are never shown: tiers, rubles, dates.

type Offer = { available: boolean; new_charges?: boolean; currency?: string; duration_days?: number; min_rub?: number; max_rub?: number; tiers_rub?: number[] };
type Status = { active: boolean; equipped_aura: string | null; active_until: number | null; grants: Grant[]; tier_points?: number; tier_until?: number | null };
type Dashboard = { providers: string[]; supporter: Status; recognition?: SupporterRecognition; yookassa: Offer };
type Payment = { attempt_id: string; amount_minor: number; currency: string; status: 'pending' | 'succeeded' | 'canceled' | 'review'; refunded_minor: number; created_at: number; settled_at: number | null };
type ReturnState = 'checking' | 'succeeded' | 'canceled' | 'review' | 'pending' | 'signed_out';

/** How often and how long the return page asks whether the payment went through. */
const RETURN_POLLS = 5, RETURN_INTERVAL_MS = 1500;
const LOCALES = { en: 'en-GB', ru: 'ru-RU', zh: 'zh-CN' } as const;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** `{offer}`, `{tier}`, `{until}` … in a translated sentence become their elements. */
function fill(template: string, parts: Record<string, React.ReactNode>) {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{key && parts[key] !== undefined ? parts[key] : part}</Fragment>;
  });
}

/** A tier's aura in CSS: a glowing ring in its colour; the Prism tiers shimmer through the rainbow. */
export function TierAura({ id, size = 'card' }: { id: string; size?: 'card' | 'stage' }) {
  const tier = TIERS.find(item => item.id === id);
  const color = tier?.color ?? BASE_STYLES.find(style => style.id === id)?.color ?? null;
  const variables: Record<string, string> = tier?.prism ? { '--prism-period': (1 / tier.prism).toFixed(2) + 's' } : { '--tier': color ?? 'var(--mint)' };
  const style = variables as React.CSSProperties;
  return <span className={'tier-aura ' + size + (tier?.prism ? ' prism' : '')} data-tier-aura={id} style={style} aria-hidden="true">
    <span className="tier-ring" /><span className="tier-core" />
    {id === 'prism_ii' || id === 'prism_iii' ? <span className="tier-sparks" /> : null}
    {id === 'prism_iii' ? <span className="tier-crown" /> : null}
  </span>;
}

function useCheckoutError() {
  const { t } = useLocale();
  return (error: unknown) => {
    if (error instanceof ApiFailure) {
      switch (error.code) {
        case 'reload': return t('The price or period changed. We reloaded the offer: check the amount and confirm again.');
        case 'amount_not_allowed': return t('Choose a whole amount from 100 to 100 000 ₽.');
        case 'receipt_email_invalid': return t('Enter a valid e-mail for the receipt.');
        case 'payment_in_progress': return t('This payment is still being processed. Wait a minute and check your history; do not pay again.');
        case 'payment_succeeded': return t('Your previous payment of this amount has already gone through. Press the button again to make a new payment.');
        case 'payment_canceled': return t('Your previous payment of this amount was not completed. Press the button again to start a new payment.');
        case 'payment_manual_review': return t('Your previous payment needs a manual check by the operator. Do not pay again; write to support if the aura does not appear within a day.');
        case 'too_many_open_payments': return t('You have too many unfinished payments today. Finish one of them or try again tomorrow.');
        case 'new_charges_paused': return t('Payments are paused for a short while. Please try again later.');
        case 'invalid_request': return t('Check the amount, the e-mail and the offer, then try again.');
      }
      if (error.status === 401) return t('Sign in again.');
      if (error.status === 429) return t('Too many requests. Please wait.');
      if (error.status >= 500) return t('The service is temporarily unavailable. Please try later.');
    }
    return t('The payment could not be started. Check the details and try again.');
  };
}

/** `signedIn`: a portal session exists (a boolean, so the shell's account refreshes do not restart the return polling). */
export default function HeroTiersView({ signedIn, accountDisabled = false, loginHref }: { signedIn: boolean; accountDisabled?: boolean; loginHref: string }) {
  const { t, locale } = useLocale();
  const { supporterLinks, legal } = useMarket();
  const router = useRouter();
  const paid = useSearchParams().get('paid') === '1';
  const checkoutError = useCheckoutError();
  const tag = LOCALES[locale];
  const [data, setData] = useState<Dashboard | null>(null), [payments, setPayments] = useState<Payment[]>([]);
  const [loadError, setLoadError] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [choice, setChoice] = useState<number | 'custom'>(1000), [custom, setCustom] = useState('');
  const [email, setEmail] = useState(''), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false);
  const [aura, setAura] = useState<string>('rose');
  const [returnState, setReturnState] = useState<ReturnState | null>(paid ? (signedIn ? 'checking' : 'signed_out') : null);
  const [now, setNow] = useState<number | null>(null);
  // The return polling has loaded the page already; leaving `?paid=1` needs no extra read.
  const returned = useRef(false);

  const load = useCallback(async () => {
    // In this order: reading the payment list re-reads the newest open payment from
    // YooKassa and settles it, so the dashboard read after it already shows its tier.
    // In parallel the dashboard could come back from before that settlement.
    const list = await api<{ payments: Payment[] }>('me/supporter/yookassa/payments');
    const dashboard = await api<Dashboard>('me/supporter');
    setData(dashboard); setPayments(list.payments); setLoadError(false);
    const supporter = dashboard.supporter;
    setAura(supporter.equipped_aura ?? (supporter.active ? tierFor(supporter.tier_points ?? 0)?.id ?? 'solar' : 'rose'));
    return { dashboard, list };
  }, []);
  useEffect(() => { setNow(Math.floor(Date.now() / 1000)); const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    // Back from YooKassa the polling below loads the page.
    if (!signedIn || paid || returned.current) return;
    let live = true;
    load().catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [signedIn, paid, load]);
  // Back from YooKassa (`?paid=1`): ask the payment list (it re-reads the newest open
  // payment from YooKassa) and `me/supporter` up to five times, 1.5 s apart.
  useEffect(() => {
    if (!paid || !signedIn) return;
    let live = true;
    void (async () => {
      let state: ReturnState = 'pending';
      for (let poll = 0; poll < RETURN_POLLS && live; poll++) {
        if (poll) await wait(RETURN_INTERVAL_MS);
        try {
          const { list } = await load();
          const newest = list.payments[0]?.status;
          if (newest === 'succeeded' || newest === 'canceled' || newest === 'review') { state = newest; break; }
        } catch { /* keep asking; the last state says to wait */ }
      }
      if (!live) return;
      returned.current = true;
      setReturnState(state);
      router.replace('/supporter', { scroll: false });
    })();
    return () => { live = false; };
  }, [paid, signedIn, load, router]);

  const offer = data?.yookassa;
  const amount = choice === 'custom' ? parseRubles(custom) : choice;
  const email_ = receiptEmail(email);
  const reaches = amount === null ? null : tierFor(amount);
  const open = Boolean(offer?.available && offer.new_charges);
  // The accepted offer is the version `/offer` shows (the market's legal table).
  const offerVersion = legal.version;
  const ready = Boolean(signedIn && open && amount !== null && email_ && accepted && !busy && offer?.currency && offer.duration_days && offerVersion);
  const status = data?.supporter;
  const date = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(tag, { dateStyle: 'long' });
  // Payments made on one day end on one day: a lower tier that would last only until the
  // same calendar date as the step before it is not shown ("Prism III until 4 Dec, then
  // Crimson until 4 Dec" says nothing).
  const steps = (status && now !== null ? tierSteps(status, now) : [])
    .filter((step, index, all) => index === 0 || date(step.until) !== date(all[index - 1].until));
  const rubles = (rub: number) => formatRubles(rub * 100, tag);

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || amount === null || !email_ || !offer?.currency || !offer.duration_days || !offerVersion) return;
    setBusy(true); setError(''); setMessage('');
    try {
      // The Idempotency-Key of this attempt is the portal server's, not this page's.
      const result = await api<{ confirmation_url: string }>('me/supporter/yookassa/checkout', 'POST', {
        amount_rub: amount, receipt_email: email_, quote: quoteFor(amount, { currency: offer.currency, duration_days: offer.duration_days }), offer_version: offerVersion,
      });
      window.location.assign(result.confirmation_url);
    } catch (failure) {
      setError(checkoutError(failure));
      if (failure instanceof ApiFailure && ['reload', 'payment_succeeded', 'payment_canceled', 'new_charges_paused'].includes(failure.code)) await load().catch(() => setLoadError(true));
      setBusy(false);
    }
  }
  async function equip(next: string | null) {
    setBusy(true); setError(''); setMessage('');
    try {
      const dashboard = await api<Dashboard>('me/supporter/aura', 'PATCH', { aura: next });
      setData(current => current ? { ...current, ...dashboard } : dashboard);
      setMessage(next ? t('Aura selected. The game receives it with the next server update.') : t('Aura hidden. Your Hero tier stays active.'));
    } catch (failure) {
      setError(failure instanceof ApiFailure && failure.code === 'tier_required' ? t('Your current tier does not include this aura yet.') : failure instanceof ApiFailure && failure.code === 'supporter_required' ? t('An active Hero payment is required to equip an aura.') : checkoutError(failure));
    } finally { setBusy(false); }
  }
  async function recognition(visible: boolean) {
    setBusy(true); setError(''); setMessage('');
    try {
      const value = await api<SupporterRecognition>('me/supporter/recognition', 'PATCH', { visible });
      setData(current => current ? { ...current, recognition: value } : current);
      setMessage(t('Recognition preference saved.'));
    } catch (failure) { setError(checkoutError(failure)); } finally { setBusy(false); }
  }

  const offerLink = <Link href="/offer" data-offer-link>{t('the public offer')}</Link>;
  return <div className="hero-tiers" data-hero-tiers>
    <div className="page-heading"><span className="eyebrow">{t('SUPPORT OMOBA · HERO')}</span><h1>{t('Light up your hero.')}</h1>
      <p>{t('Support OMOBA voluntarily. Each payment gives your hero an aura for 30 days that every player in your matches sees. It changes appearance only: stats, rating and matchmaking stay equal for everyone.')}</p></div>
    {returnState ? <p role="status" className={'notice tier-return ' + returnState} data-return-state={returnState}>
      {returnState === 'checking' ? <><strong>{t('Checking your payment…')}</strong> {t('Do not pay again.')}</>
        : returnState === 'succeeded' ? t('Payment received. Thank you! Your aura is active; the game shows it with the next server update.')
        : returnState === 'canceled' ? t('The payment was not completed, and no money was taken. You can choose an amount and try again.')
        : returnState === 'review' ? t('Your payment needs a manual check by the operator. Do not pay again; the aura appears once it is confirmed.')
        : returnState === 'signed_out' ? t('Sign in to see whether your payment went through. Do not pay again.')
        : <><strong>{t('Your payment is still being confirmed.')}</strong> {t('Do not pay again: the aura appears by itself as soon as the payment is confirmed. Check your history in a few minutes.')}</>}
    </p> : null}
    {error ? <p role="alert" className="notice error" data-checkout-error>{error}</p> : null}
    {message ? <p role="status" className="notice">{message}</p> : null}
    {loadError ? <p role="alert" className="notice error">{t('Your Hero status could not be loaded. Please try again.')} <button onClick={() => void load().catch(() => setLoadError(true))}>{t('Try again')}</button></p> : null}

    {status ? <section className="card tier-status" data-tier-status>
      <div className="section-heading"><h2>{t('Your Hero')}</h2><span className={'tag ' + (status.active ? 'accent' : '')}>{status.active ? t('Hero active') : t('No active payment')}</span></div>
      {steps.length ? <p data-tier-steps>{steps.map((step, index) => <Fragment key={step.until}>
        {index ? ' ' : ''}{fill(index ? t('Then {tier} until {until}.') : t('Your tier is {tier} until {until}.'), { tier: <strong data-step-tier={step.tier}>{auraName(step.tier, locale)}</strong>, until: <time dateTime={new Date(step.until * 1000).toISOString()}>{date(step.until)}</time> })}
      </Fragment>)}</p> : status.active && status.active_until ? <p>{fill(t('Hero is active until {until}. Payments from 100 ₽ within 30 days unlock a tier aura.'), { until: date(status.active_until) })}</p>
        : <p className="muted">{t('You have no active payment. Each payment lasts 30 days.')}</p>}
      {status.active ? <>
        <h3>{t('Your aura')}</h3>
        <div className="aura-choices tier-choices" role="group" aria-label={t('Aura color')}>{AURA_STYLES.map(style => {
          const unlocked = styleUnlocked(style, status), tier = TIERS.find(item => item.id === style);
          return <button key={style} type="button" className="aura-choice" data-style={style} aria-pressed={aura === style} disabled={!unlocked || busy} onClick={() => setAura(style)}>
            <TierAura id={style} />{auraName(style, locale)}{!unlocked && tier ? <small>{fill(t('from {amount} within 30 days'), { amount: rubles(tier.points) })}</small> : null}</button>;
        })}</div>
        <div className="tier-actions"><button className="primary" disabled={busy || !styleUnlocked(aura, status)} onClick={() => void equip(aura)}>{t('Equip in game')}</button>
          <button disabled={busy} onClick={() => void equip(null)}>{t('Hide aura')}</button></div>
      </> : null}
    </section> : null}

    <section className="card" aria-labelledby="tier-cards-title">
      <h2 id="tier-cards-title">{t('Hero tiers')}</h2>
      <p className="muted" data-tier-stacking>{fill(t('Each payment lasts 30 days. All your payments within those 30 days add up to a higher tier: {small} every month keeps {rose}, {large} every month keeps {crimson}. Any active payment also unlocks the {solar}, {lunar} and {verdant} auras.'),
        { small: rubles(100), large: rubles(1000), ...Object.fromEntries(['rose', 'crimson', 'solar', 'lunar', 'verdant'].map(id => [id, auraName(id, locale)])) })}</p>
      <form onSubmit={event => void pay(event)} data-checkout-form>
        <fieldset className="tier-cards" disabled={busy}>
          <legend className="visually-hidden">{t('Amount')}</legend>
          {TIERS.map((tier: Tier) => <label key={tier.id} className={'tier-card' + (choice === tier.points ? ' selected' : '')} data-tier-card={tier.id}>
            <input type="radio" name="amount" value={tier.points} checked={choice === tier.points} onChange={() => setChoice(tier.points)} />
            <TierAura id={tier.id} />
            <span className="tier-swatch" style={tier.color ? { background: tier.color } : undefined} data-swatch={tier.color ?? 'prism'} aria-hidden="true" />
            <strong>{auraName(tier.id, locale)}</strong>
            <span className="tier-price" data-price={tier.points}>{rubles(tier.points)}</span>
            <small>{t('aura for 30 days')}</small>
          </label>)}
          <label className={'tier-card custom' + (choice === 'custom' ? ' selected' : '')} data-tier-card="custom">
            <input type="radio" name="amount" value="custom" checked={choice === 'custom'} onChange={() => setChoice('custom')} />
            <strong>{t('Your amount')}</strong>
            <input className="tier-custom" inputMode="numeric" autoComplete="off" aria-label={t('Your amount in rubles')} placeholder="1 500" value={custom} maxLength={9}
              onChange={event => { setCustom(event.target.value); setChoice('custom'); }} onFocus={() => setChoice('custom')} />
            <small>{fill(t('from {min} to {max}, whole rubles'), { min: rubles(MIN_RUB), max: rubles(MAX_RUB) })}</small>
          </label>
        </fieldset>
        <p className="tier-summary" data-tier-summary aria-live="polite">{amount === null
          ? t('Choose a whole amount from 100 to 100 000 ₽.')
          : fill(t('{amount} · aura for {days} days · this payment alone reaches {tier}'), { amount: <strong>{rubles(amount)}</strong>, days: offer?.duration_days ?? GRANT_DAYS, tier: <strong data-summary-tier={reaches?.id}>{reaches ? auraName(reaches.id, locale) : '—'}</strong> })}</p>
        {signedIn ? <>
          {data && !offer?.available ? <p className="notice" data-payments-unavailable>{t('Payments are not open yet. You can already look at the tiers.')}</p>
            : data && !offer?.new_charges ? <p className="notice" data-payments-paused>{t('Payments are paused for a short while. Please try again later.')}</p> : null}
          <label>{t('E-mail for the receipt')}<input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
            <small>{t('The fiscal receipt (54-FZ) is sent to this address. It is used only for the receipt.')}</small></label>
          <label className="toggle tier-accept"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} required />
            <span>{fill(t('I have read and accept {offer}.'), { offer: offerLink })}</span></label>
          <button className="primary" disabled={!ready} data-checkout-submit>{amount === null ? t('Continue to payment') : fill(t('Pay {amount}'), { amount: rubles(amount) })}</button>
          <p className="muted">{t('You pay on the YooKassa page and come back here afterwards. One payment, no automatic renewal.')}</p>
        </> : accountDisabled ? <p className="notice">{t('Payments are not available on this site.')}</p>
          : <div className="tier-guest" data-tier-guest><Link className="button primary" href={loginHref}>{t('Sign in to support')} →</Link>
            <p className="muted">{fill(t('Prices and {offer} are open to everyone; paying needs your OMOBA account so that the aura reaches your hero.'), { offer: offerLink })}</p></div>}
      </form>
    </section>

    <section className="card tier-preview-card" aria-label={t('Stylized aura preview')}>
      <div className="aura-stage tier-stage"><Image className="aura-hero" src="/art/supporter/spellblade.webp" width={1024} height={1024} sizes="(max-width: 760px) calc(100vw - 70px), 420px"
        alt={t('Silver-armored hero with a sword and a glowing blue aura')} /><TierAura id={reaches?.id ?? 'rose'} size="stage" /></div>
      <p className="muted">{t('Effect illustration. In the game, the aura follows your character.')}</p>
    </section>

    {signedIn && payments.length ? <section className="card" data-payment-history><h2>{t('Your payments')}</h2>
      {payments.map(payment => <div className="friend-row" key={payment.attempt_id} data-payment={payment.status}>
        <div className="grow"><strong>{formatRubles(payment.amount_minor, tag)}</strong><small>{new Date(payment.created_at * 1000).toLocaleString(tag)}</small></div>
        {payment.refunded_minor > 0 ? <small>{fill(t('refunded {amount}'), { amount: formatRubles(payment.refunded_minor, tag) })}</small> : null}
        <span className="tag">{payment.status === 'succeeded' ? t('Paid') : payment.status === 'canceled' ? t('Not completed') : payment.status === 'review' ? t('Manual check') : t('Being confirmed')}</span>
      </div>)}
      <p className="muted">{t('A refunded amount no longer counts towards your tier.')}</p></section> : null}

    {data?.recognition ? <section className="card recognition-settings">
      <div className="section-heading"><h2>{t('Public recognition')}</h2><span className="supporter-months"><strong>{data.recognition.months_supported.toLocaleString(tag)}</strong> {t('Months supported')}</span></div>
      <label className="toggle"><input type="checkbox" checked={data.recognition.visible} disabled={busy} onChange={event => void recognition(event.target.checked)} />{t('Show my name and supported months in the public directory')}</label>
      <p className="muted">{t('This is optional. Your profile must also be public; statistics keep their own privacy setting.')}</p>
      {!data.recognition.public_profile_enabled ? <p className="notice">{t('Your profile is private, so you are not listed. You can review profile visibility in Settings.')}</p> : null}
      <div className="supporter-links">{supporterLinks ? <Link className="button" href="/supporters">{t('Meet the supporters')} →</Link> : null}<Link className="button" href="/settings">{t('Profile visibility')}</Link></div>
    </section> : null}
    {signedIn ? <p><Link href="/devices">{t('Devices and account recovery')} →</Link></p> : null}
  </div>;
}
