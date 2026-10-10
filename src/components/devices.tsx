'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, accountError } from '@/lib/client-api';
import { useLocale } from '@/components/locale-provider';
import type { Locale } from '@/lib/i18n';

type Device = { public_key: string; label: string; created_at: string; revoked_at: string | null };
type Devices = { devices: Device[]; recovery_codes_remaining: number };
type Enrollment = { enrollment_id: string; public_key: string; label: string; expires_at: string; nickname: string; profile_id: string };
const fingerprint = (key: string) => key.slice(0, 8) + '…' + key.slice(-8);

export default function DevicesView({ locale, nickname }: { locale: Locale; nickname: string }) {
  const { t } = useLocale();
  const [data, setData] = useState<Devices | null>(null), [code, setCode] = useState('');
  const [candidate, setCandidate] = useState<Enrollment | null>(null), [codes, setCodes] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const refresh = useCallback(async () => { setData(await api<Devices>('me/devices')); }, []);
  useEffect(() => { let live = true; api<Devices>('me/devices').then(v => { if (live) setData(v); }).catch(e => { if (live) setError(accountError(e, false)); }); return () => { live = false; }; }, []);
  async function act(job: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await job(); } catch (e) { setError(accountError(e, false)); } finally { setBusy(false); } }
  async function lookup() { await act(async () => { setCandidate(null); setCandidate(await api<Enrollment>('me/devices/lookup', 'POST', { code })); }); }
  return <>
    <div className="page-heading"><span className="eyebrow">{t('OMOBA ACCOUNT')}</span><h1>{t("One account. Every device.")}</h1><p>{t("Keep your progress and cosmetics on your phone and computer.")}</p></div>
    {error && <p className="notice error" role="alert">{t(error)}</p>}{message && <p className="notice" role="status">{t(message)}</p>}
    <section className="card"><h2>{t("Connect a device")}</h2><p>{t("On the new device, open Profile → account linking and get a code. Enter it here. Only approve your own device.")}</p>
      <form className="filters" onSubmit={e => { e.preventDefault(); void lookup(); }}><label>{t("Code from your new device")}<input value={code} onChange={e => { setCode(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, 8)); setCandidate(null); }} placeholder="ABCD2345" minLength={8} maxLength={8} pattern="[A-Z0-9]{8}" autoComplete="off" autoCapitalize="characters" spellCheck={false} required /></label><button className="primary" disabled={busy || code.length !== 8}>{t("Review device")}</button></form>
      {candidate && <div className="device-confirm"><h3>{t("Confirm account link")}</h3><p><strong>{candidate.label}</strong> · <code>{fingerprint(candidate.public_key)}</code></p><p>{t("Will get access to")} <strong>{candidate.nickname}</strong></p><p className="muted">{t("Compare the key fingerprint on your new device. Its previous profile will not be merged with this account.")}</p><p className="muted">{t("Expires at")} {new Date(candidate.expires_at).toLocaleTimeString(locale)}</p><button disabled={busy || Date.parse(candidate.expires_at) <= now} className="primary" onClick={() => void act(async () => { await api('me/devices/approve', 'POST', { enrollment_id: candidate.enrollment_id, public_key: candidate.public_key }); setCandidate(null); setCode(''); setMessage("Link approved. Complete it on your new device."); await refresh(); })}>{t("Allow access")}</button><button disabled={busy} onClick={() => setCandidate(null)}>{t("Cancel")}</button></div>}
    </section>
    <section className="card"><h2>{t("Your devices")}</h2><p className="muted">{nickname}</p>{!data && <p role="status">{t("Loading…")}</p>}{data?.devices.map(device => <div className="friend-row" key={device.public_key}><div className="grow"><strong>{device.label}</strong><small><code>{fingerprint(device.public_key)}</code> · {new Date(device.created_at).toLocaleDateString(locale)}</small></div>{device.revoked_at ? <span className="tag">{t("Revoked")}</span> : <button disabled={busy} onClick={() => { if (!window.confirm(t("Revoke this device? Browser sessions will also end. Make sure you have another device or recovery code."))) return; void act(async () => { await api('me/devices/' + device.public_key, 'DELETE'); window.location.assign('/login'); }); }}>{t("Revoke")}</button>}</div>)}</section>
    <section className="card"><h2>{t("Account recovery")}</h2><p>{t("Save recovery codes in your password manager. Each code works once in the game if you lose access to your devices. A nickname alone cannot recover an account. After recovery, revoke lost devices in the list above.")}</p>
      <p>{t("Codes remaining:")} <strong>{data?.recovery_codes_remaining ?? '—'}</strong></p>
      {codes.length ? <div className="recovery-codes"><p className="notice">{t("These codes are shown only now. Do not share them.")}</p><textarea readOnly rows={9} value={codes.join('\n')} aria-label={t("Recovery codes")} spellCheck={false} /><button onClick={() => { void navigator.clipboard.writeText(codes.join('\n')).then(() => setMessage("Codes copied. Save them somewhere safe.")).catch(() => setError("Select and copy the codes manually.")); }}>{t("Copy codes")}</button><button onClick={() => setCodes([])}>{t("I saved my codes — hide")}</button></div> : <button disabled={busy} onClick={() => { if (data?.recovery_codes_remaining && !window.confirm(t("New codes replace all previous codes. Continue?"))) return; void act(async () => { const result = await api<{ recovery_codes: string[] }>('me/recovery-codes', 'POST', {}); setCodes(result.recovery_codes); await refresh(); }); }}>{t("Generate recovery codes")}</button>}
    </section>
  </>;
}
