'use client';
import { useLocale } from '@/components/locale-provider';
import { useMarket } from '@/components/market-profile';

export type SocialTicket = { display_name: string; expires_at: string };
export type VkMethod = 'vkid' | 'ok_ru' | 'mail_ru';

/** `{name}` placeholders in an already translated template. */
export function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Brand colours of the three VK ID account types; drawn as monograms, no SDK or image. */
const METHODS: { method: VkMethod; mark: string }[] = [
  { method: 'vkid', mark: 'VK' },
  { method: 'ok_ru', mark: 'OK' },
  { method: 'mail_ru', mark: '@' },
];

export function useMethodLabel() {
  const { t } = useLocale();
  return (method: string) => method === 'vkid' ? t('Sign in with VK ID') : method === 'ok_ru' ? t('Odnoklassniki') : method === 'mail_ru' ? 'Mail.ru' : method;
}

/**
 * Where the market signs in with VK ID (LR-18): progress follows the VK-linked
 * account, so a reinstall or a new device gets the profile back with the same
 * VK ID; recovery codes work everywhere. Guest home, sign-in, `/connect` and Devices.
 */
export function ProgressFollowsVk() {
  const { t } = useLocale();
  const { features } = useMarket();
  if (!features.vkSignIn) return null;
  return <p data-progress-follows-vk>{t('Progress follows the VK-linked account. After a reinstall or on a new device, open Profile → “Sign in with VK ID” in the game and sign in with the same VK ID to get your profile back. Recovery codes work on any device too.')}</p>;
}

/** VK, OK and Mail.ru are one VK ID app; `provider` picks the account type. */
export function VkSignInButtons({ returnTo }: { returnTo: string }) {
  const label = useMethodLabel();
  return <div className="vk-buttons">{METHODS.map(({ method, mark }) =>
    <a key={method} className={'button vk-button vk-' + method} data-vk-method={method}
      href={'/api/auth/vk/start?' + new URLSearchParams({ method, returnTo })}>
      <span className="vk-mark" aria-hidden="true">{mark}</span><span>{label(method)}</span>
    </a>)}</div>;
}

/** Messages for `/login?signin=…` (vk-id.mjs SIGNIN_FAILURES); anything else shows nothing. */
export function useSigninFailure() {
  const { t } = useLocale();
  return (reason: string | null) => {
    switch (reason) {
      case 'failed': return t('VK ID sign-in did not complete. Try again.');
      case 'cancelled': return t('Sign-in was cancelled.');
      case 'rejected': return t('VK ID did not confirm this sign-in. Try again or choose another account.');
      case 'provider_unavailable': return t('VK ID is not responding right now. Try again in a few minutes.');
      case 'unavailable': return t('Sign-in with VK ID is unavailable right now. Try again later.');
      case 'session_limit': return t('Too many active browser sessions. Sign out on another browser and try again.');
      case 'rate_limited': return t('Too many sign-in attempts. Please wait a minute.');
      default: return null;
    }
  };
}

/**
 * A VK ID sign-in that is not linked to a game profile yet: the player finishes
 * registration in the game, which links its own profile with its device key.
 */
export function RegistrationView({ ticket, onSignOut, busy, children }: { ticket: SocialTicket; onSignOut: () => void; busy: boolean; children?: React.ReactNode }) {
  const { t, locale } = useLocale();
  return <>
    <section className="card login-card registration-card" data-registration>
      <span className="eyebrow">{t('VK ID · NEW PLAYER')}</span>
      <h1>{t('Almost there')}</h1>
      <p className="registration-confirmed"><strong>{fill(t('VK account “{name}” confirmed.'), { name: ticket.display_name })}</strong></p>
      <p>{t('Install OMOBA, open Profile → “Sign in with VK ID” — your game profile will be linked to this VK account.')}</p>
      <p className="muted">{t('The confirmation is valid until')} {new Date(ticket.expires_at).toLocaleTimeString(locale)}</p>
      <button disabled={busy} onClick={onSignOut}>{t('Use another account')}</button>
    </section>
    {children}
  </>;
}
