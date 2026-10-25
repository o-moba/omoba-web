'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiFailure } from '@/lib/client-api';
import { CONNECT_CODE, portalLoginHref } from '@/lib/navigation.mjs';
import { useLocale } from '@/components/locale-provider';
import { useMarket } from '@/components/market-profile';
import { ProgressFollowsVk, VkSignInButtons, fill, type SocialTicket } from '@/components/social';

type Enrollment = { enrollment_id: string; public_key: string; label: string; expires_at: string; nickname: string; profile_id: string };
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
export default function ConnectView({ signedIn, socialTicket }: { signedIn: boolean; socialTicket: SocialTicket | null }) {
  const { t, locale } = useLocale();
  const { features } = useMarket();
  const raw = useSearchParams().get('code') || '';
  const code = CONNECT_CODE.test(raw) ? raw : null;
  const here = code ? '/connect?code=' + code : '/me';
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' }), [busy, setBusy] = useState(false);
  function failed(error: unknown): Phase {
    if (error instanceof ApiFailure) {
      // A VK account linked meanwhile signs in again and approves as that account.
      if (error.code === 'fresh_confirmation_required' || error.code === 'already_linked') return { kind: 'fresh' };
      if (error.status === 404 || error.status === 410) return { kind: 'expired' };
      if (error.status === 409) return { kind: 'conflict' };
      return { kind: 'error', status: error.status };
    }
    return { kind: 'error', status: 0 };
  }
  useEffect(() => {
    if (!code || !signedIn) return;
    let live = true;
    setPhase({ kind: 'checking' });
    api<Enrollment>('me/devices/lookup', 'POST', { code })
      .then(enrollment => { if (live) setPhase({ kind: 'review', enrollment }); })
      .catch(error => { if (live) setPhase(failed(error)); });
    return () => { live = false; };
  }, [code, signedIn]);
  async function run(job: () => Promise<Phase>) {
    if (busy) return;
    setBusy(true);
    try { setPhase(await job()); } catch (error) { setPhase(failed(error)); } finally { setBusy(false); }
  }
  const signIn = <>
    {features.vkSignIn ? <VkSignInButtons returnTo={here} /> : null}
    <ProgressFollowsVk />
    <p className="muted separated"><Link href={portalLoginHref(here, features)}>{t('Connect your game instead')} →</Link></p>
  </>;
  let body: React.ReactNode;
  if (!code) body = <p role="alert" className="notice error">{t('This link has no valid device code. Open it again from the game.')}</p>;
  else if (phase.kind === 'approved' || phase.kind === 'attached') body = <p role="status" className="notice" data-connect-done>{phase.kind === 'approved' ? t('Done. Return to the game and confirm sign-in.') : t('Return to the game and confirm.')}</p>;
  else if (phase.kind === 'expired') body = <p role="alert" className="notice error">{socialTicket && !signedIn ? t('The code or the VK confirmation expired. Start again in the game.') : t('The code expired. Start again in the game.')}</p>;
  else if (phase.kind === 'conflict') body = <p role="status" className="notice">{t('This code is already linked. Return to the game and confirm.')}</p>;
  else if (phase.kind === 'fresh') body = <><p role="alert" className="notice">{features.vkSignIn ? t('For your security, sign in with VK again to confirm this device.') : t('Confirm sign-in through the game again.')}</p>{signIn}</>;
  else if (phase.kind === 'error') body = <p role="alert" className="notice error">{phase.status === 429 ? t('Too many requests. Please wait a moment.') : t('The account service is unavailable. Please try again shortly.')}</p>;
  else if (signedIn) {
    if (phase.kind !== 'review') body = <p role="status" className="muted">{t('Checking the code…')}</p>;
    else {
      const { enrollment } = phase;
      body = <div className="device-confirm" data-connect-review>
        <h2>{fill(t('Sign in as {nickname} on the device “{label}”?'), { nickname: enrollment.nickname, label: enrollment.label })}</h2>
        <p>{t('Key fingerprint')}: <code>{fingerprint(enrollment.public_key)}</code></p>
        <p className="muted">{t('Compare it with the fingerprint shown in the game.')} {t('Expires at')} {new Date(enrollment.expires_at).toLocaleTimeString(locale)}</p>
        <button className="primary" disabled={busy} onClick={() => void run(async () => {
          await api('me/devices/approve', 'POST', { enrollment_id: enrollment.enrollment_id, public_key: enrollment.public_key });
          return { kind: 'approved' };
        })}>{t('Confirm sign-in')}</button>
      </div>;
    }
  } else if (socialTicket) body = <>
    <p>{fill(t('VK “{name}” is not linked to an OMOBA profile yet. Press “Continue” and confirm the link in the game.'), { name: socialTicket.display_name })}</p>
    <button className="primary" disabled={busy} data-connect-attach onClick={() => void run(async () => {
      await api('auth/social/attach', 'POST', { code });
      return { kind: 'attached' };
    })}>{t('Continue')}</button>
  </>;
  else body = <><p>{t('Sign in to confirm this device.')}</p>{signIn}</>;
  return <section className="card login-card connect-card" data-connect>
    <span className="eyebrow">{t('CONNECT A DEVICE')}</span>
    <h1>{t('Sign in on your device')}</h1>
    {code ? <p className="pair-code connect-code" aria-label={code}>{code.slice(0, 4)}—{code.slice(4)}</p> : null}
    {body}
  </section>;
}
