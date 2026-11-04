'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/client-api';
import { oneTapConfiguration, oneTapPayload, localSignInLocation } from '@/lib/vk-one-tap-client.mjs';
import { useLocale } from '@/components/locale-provider';
import './vk-one-tap.css';

/** The provider owns the VK/OK/Mail widget. OMOBA owns PKCE and its session. */
export default function VkOneTap({ returnTo, children }: { returnTo: string; children: ReactNode }) {
  const { t, locale } = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'completing' | 'failed'>('loading');
  const [revision, setRevision] = useState(0);
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    let live = true, closing = false;
    const controller = new AbortController();
    let widget: import('@vkid/sdk').OneTap | undefined;
    setStatus('loading');
    setRendered(false);
    const failed = () => { if (live) setStatus('failed'); };
    void (async () => {
      const value = await api<unknown>('auth/vk/one-tap/prepare', 'POST', { returnTo }, undefined, controller.signal);
      if (!live) return;
      const configuration = oneTapConfiguration(value, window.location.origin);
      const sdk = await import('@vkid/sdk');
      if (!live || !container.current) return;
      sdk.Config.init({ ...configuration, responseMode: sdk.ConfigResponseMode.Callback,
        mode: sdk.ConfigAuthMode.InNewWindow, source: sdk.ConfigSource.LOWCODE });
      widget = new sdk.OneTap();
      widget.on(sdk.WidgetEvents.ERROR, failed);
      widget.on(sdk.OneTapInternalEvents.LOGIN_SUCCESS, (payload: unknown) => {
        if (!live || closing) return;
        closing = true;
        setStatus('completing');
        void (async () => {
          const body = oneTapPayload(payload, configuration.state);
          const result = await api<{ location: string }>('auth/vk/one-tap/complete', 'POST', body, undefined, controller.signal);
          if (live) window.location.assign(localSignInLocation(result.location, window.location.origin));
        })().catch(() => { closing = false; failed(); });
      });
      widget.render({ container: container.current, showAlternativeLogin: true,
        oauthList: [sdk.OAuthName.OK, sdk.OAuthName.MAIL], scheme: sdk.Scheme.DARK,
        lang: locale === 'en' ? sdk.Languages.ENG : sdk.Languages.RUS,
        styles: { height: 48, borderRadius: 12 } });
      setRendered(true);
      setStatus('ready');
    })().catch(failed);
    return () => { live = false; controller.abort(); widget?.close(); };
  }, [returnTo, locale, revision]);
  return <div className="vk-one-tap" data-vk-one-tap={status}>
    <div ref={container} aria-label={t('Sign in with VK ID')} hidden={status === 'failed' && !rendered} />
    {status === 'loading' ? <p role="status" className="muted">{t('Loading VK ID…')}</p> : null}
    {status === 'completing' ? <p role="status">{t('Completing sign-in…')}</p> : null}
    {status === 'failed' ? <p role="status" className="muted">{t('Quick sign-in did not complete. Choose a service or try again.')} <button onClick={() => setRevision(value => value + 1)}>{t('Try again')}</button></p> : null}
    <details className="vk-fallback" open={status === 'failed' && !rendered} data-vk-fallback>
      <summary>{t('Other sign-in methods')}</summary>{children}
    </details>
  </div>;
}
