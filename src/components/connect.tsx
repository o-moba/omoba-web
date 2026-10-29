'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiFailure } from '@/lib/client-api';
import { CONNECT_CODE, portalLoginHref } from '@/lib/navigation.mjs';
import { useLocale } from '@/components/locale-provider';
import { useMarket } from '@/components/market-profile';
import { VkSignInButtons, fill, type SocialTicket } from '@/components/social';
import { SignInLegalNotice } from '@/components/legal';
import { useContour } from '@/components/contour';
import { canOfferIosReturn, iosReturnUrl } from '@/lib/ios-universal-links.mjs';

type Enrollment = { enrollment_id: string; public_key: string; label: string; expires_at: string; nickname?: string; profile_id?: string };
type Phase =
  | { kind: 'idle' } | { kind: 'checking' } | { kind: 'review'; enrollment: Enrollment } | { kind: 'approved' }
  | { kind: 'attached' } | { kind: 'fresh' } | { kind: 'expired' } | { kind: 'conflict' } | { kind: 'error'; status: number };
const fingerprint = (key: string) => key.slice(0, 8) + '…' + key.slice(-8);

/**
 * `/connect?code=ABCD2345`, the page the game opens in the system browser for a
 * device enrollment (8 characters, 5 minutes). A session approves the device; an
 * unlinked VK ID sign-in offers its identity to the enrollment; otherwise the
 * player signs in first and comes back here.
 */
export default function ConnectView({ signedIn, currentProfileId, socialTicket, onAccountChanged }: { signedIn: boolean; currentProfileId: string | null; socialTicket: SocialTicket | null; onAccountChanged: () => Promise<void> }) {
  const { t, locale } = useLocale();
  const { features, market } = useMarket();
  const contour = useContour();
  const raw = useSearchParams().get('code') || '';
  const code = CONNECT_CODE.test(raw) ? raw : null;
  const here = code ? '/connect?code=' + code : '/me';
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' }), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const [accountChanged, setAccountChanged] = useState(false);
  const [offerReturn, setOfferReturn] = useState(false);
  useEffect(() => {
    setOfferReturn(canOfferIosReturn(market, phase.kind, navigator.userAgent, navigator.platform, navigator.maxTouchPoints));
  }, [market, phase.kind]);
  useEffect(() => { setAccountChanged(false); }, [code]);
  function failed(error: unknown): Phase {
    if (error instanceof ApiFailure) {
      // A VK account linked meanwhile signs in again and approves as that account.
      if (error.status === 401 || error.code === 'fresh_confirmation_required' || error.code === 'already_linked') return { kind: 'fresh' };
      if (error.status === 404 || error.status === 410) return { kind: 'expired' };
      if (error.status === 409) return { kind: 'conflict' };
      return { kind: 'error', status: error.status };
    }
    return { kind: 'error', status: 0 };
  }
  useEffect(() => {
    setPhase({ kind: 'idle' });
    if (!code || (!signedIn && !socialTicket)) return;
    let live = true;
    setPhase({ kind: 'checking' });
    api<Enrollment>(signedIn ? 'me/devices/lookup' : 'auth/social/enrollment', 'POST', { code })
      .then(enrollment => {
        if (signedIn && !/^[a-f0-9]{64}$/.test(enrollment.profile_id || '')) throw new ApiFailure('invalid_service_response', 502);
        if (live) setPhase({ kind: 'review', enrollment });
      })
      .catch(error => { if (live) setPhase(failed(error)); });
    return () => { live = false; };
  }, [code, signedIn, currentProfileId, socialTicket, revision]);
  async function run(job: () => Promise<Phase>) {
    if (busy) return;
    setBusy(true);
    try { setPhase(await job()); } catch (error) {
      if (error instanceof ApiFailure && error.code === 'account_changed') {
        setAccountChanged(true);
        setPhase({ kind: 'checking' });
        await onAccountChanged();
        setRevision(value => value + 1);
      } else setPhase(failed(error));
    } finally { setBusy(false); }
  }
  const signIn = <>
    {features.vkSignIn ? <VkSignInButtons returnTo={here} /> : null}
    <p className="muted separated"><Link href={portalLoginHref(here, features)}>{t('Connect your game instead')} →</Link></p>
  </>;
  let body: React.ReactNode;
  if (!code) body = <p role="alert" className="notice error">{t('This link has no valid device code. Open it again from the game.')}</p>;
  else if (phase.kind === 'approved' || phase.kind === 'attached') body = <p role="status" className="notice" data-connect-done>{phase.kind === 'approved' ? t('Done. Return to the game and confirm sign-in.') : t('Return to the game and confirm.')}</p>;
  else if (phase.kind === 'expired') body = <p role="alert" className="notice error">{socialTicket && !signedIn ? t('The code or the VK confirmation expired. Start again in the game.') : t('The code expired. Start again in the game.')}</p>;
  else if (phase.kind === 'conflict') body = <p role="status" className="notice">{t('This code is already linked. Return to the game and confirm.')}</p>;
  else if (phase.kind === 'fresh') body = <><p role="alert" className="notice">{features.vkSignIn ? t('For your security, sign in with VK again to confirm this device.') : t('Confirm sign-in through the game again.')}</p>{signIn}</>;
  else if (phase.kind === 'error') body = <div role="alert" className="notice error"><p>{phase.status === 429 ? t('Too many requests. Please wait a moment.') : t('The account service is unavailable. Please try again shortly.')}</p><button disabled={busy} onClick={() => setRevision(value => value + 1)}>{t('Try again')}</button></div>;
  else if (signedIn || socialTicket) {
    if (phase.kind !== 'review') body = <p role="status" className="muted">{t('Checking the code…')}</p>;
    else {
      const { enrollment } = phase;
      body = <div className="device-confirm" data-connect-review>
        <h2>{signedIn
          ? fill(t('Sign in as {nickname} on the device “{label}”?'), { nickname: enrollment.nickname || '', label: enrollment.label })
          : fill(t('Link VK “{name}” from the game on device “{label}”?'), { name: socialTicket!.display_name, label: enrollment.label })}</h2>
        {!signedIn ? <p>{t('Your current game profile and progress will be kept. Continue here, then confirm the link in the game.')}</p> : null}
        <p>{t('Key fingerprint')}: <code>{fingerprint(enrollment.public_key)}</code></p>
        <p className="muted">{t('Compare it with the fingerprint shown in the game.')} {t('Expires at')} {new Date(enrollment.expires_at).toLocaleTimeString(locale)}</p>
        <button className="primary" disabled={busy} data-connect-attach={!signedIn ? true : undefined} onClick={() => void run(async () => {
          if (signedIn) {
            if (!/^[a-f0-9]{64}$/.test(enrollment.profile_id || '')) throw new ApiFailure('invalid_service_response', 502);
            await api('me/devices/approve', 'POST', { enrollment_id: enrollment.enrollment_id, public_key: enrollment.public_key, profile_id: enrollment.profile_id });
            return { kind: 'approved' };
          }
          await api('auth/social/attach', 'POST', { code });
          return { kind: 'attached' };
        })}>{signedIn ? t('Confirm sign-in') : t('Continue')}</button>
      </div>;
    }
  } else body = <><p>{t('Sign in to confirm this device.')}</p>{signIn}</>;
  return <section className="card login-card connect-card" data-connect>
    <span className="eyebrow">{t('CONNECT A DEVICE')}</span>
    <h1>{t('Sign in on your device')}</h1>
    {code ? <p className="pair-code connect-code" aria-label={code}>{code.slice(0, 4)}—{code.slice(4)}</p> : null}
    {accountChanged ? <p role="status" className="notice" data-connect-account-changed>{t('The signed-in account changed. Review the account and device again before confirming.')}</p> : null}
    {body}
    {offerReturn ? <p><a className="button primary" href={iosReturnUrl(contour)} data-ios-open>{t('Return to OMOBA on this device')}</a></p> : null}
    <SignInLegalNotice />
  </section>;
}
