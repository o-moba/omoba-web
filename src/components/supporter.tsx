'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api, accountError } from '@/lib/client-api';

type Aura = 'solar' | 'lunar' | 'verdant';
type Grant = { provider: string; valid_from: number; valid_until: number; revoked: boolean; renewal_enabled: boolean | null };
type Status = { active: boolean; equipped_aura: Aura | null; active_until: number | null; grants: Grant[] };
type Membership = { supporter: Status; solana: { available: boolean; amount?: string; asset?: string; duration_days?: number; network?: string }; apple: { available: boolean; product_id?: string } };
type Order = { order_id: string; payment_url: string; amount: string; asset: string; network: string; expires_at: number; status?: 'pending' | 'confirmed'; confirmed_signature?: string | null };
const styles: Aura[] = ['solar', 'lunar', 'verdant'];

export default function SupporterView({ locale, nickname }: { locale: 'ru' | 'en'; nickname: string }) {
  const ru = locale === 'ru', t = (r: string, e: string) => ru ? r : e;
  const [data, setData] = useState<Membership | null>(null), [aura, setAura] = useState<Aura>('solar');
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null), [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { let live = true; api<Membership>('me/supporter').then(v => { if (live) { setData(v); if (v.supporter.equipped_aura) setAura(v.supporter.equipped_aura); } }).catch(e => { if (live) setError(accountError(e, ru)); }); return () => { live = false; }; }, [ru]);
  useEffect(() => { let live = true; api<{orders:Order[]}>('me/supporter/solana/orders').then(v => { if(live) setOrders(v.orders); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  async function act(job: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await job(); } catch (e) { setError(accountError(e, ru)); } finally { setBusy(false); } }
  const active = Boolean(data?.supporter.active && data.supporter.active_until && data.supporter.active_until * 1000 > now);
  const expiry = order ? order.expires_at * 1000 : 0, orderExpired = Boolean(order && (!Number.isFinite(expiry) || expiry <= now));
  const date = (seconds: number) => new Date(seconds * 1000).toLocaleString(locale);
  return <>
    <div className="page-heading"><span className="eyebrow">OPEN MOBA SUPPORTER</span><h1>{t('Пусть герой сияет.', 'Let your hero shine.')}</h1><p>{t('Поддерживайте открытую игру. Выбирайте свой свет.', 'Support an open game. Choose your own light.')}</p></div>
    {error && <p role="alert" className="notice error">{error}</p>}{message && <p role="status" className="notice">{message}</p>}
    <div className="supporter-grid"><section className={'card aura-preview ' + aura} aria-label={t('Стилизованная примерка ауры', 'Stylized aura preview')}>
      <span className="preview-label">{t('ПРИМЕРКА', 'PREVIEW')}</span>
      <div className="aura-stage">
        <Image className="aura-hero" src="/art/supporter/spellblade.webp" width={1024} height={1024}
          sizes="(max-width: 760px) calc(100vw - 70px), (max-width: 1100px) 440px, 40vw"
          preload alt={t('Герой в серебряных доспехах с мечом и сияющей голубой аурой', 'Silver-armored hero with a sword and a glowing blue aura')} />
        <div className="aura-halo" aria-hidden="true" />
      </div>
      <strong>{nickname}</strong><span className="supporter-badge">✦ SUPPORTER</span><p className="muted">{t('Эскиз эффекта. В игре аура следует за вашим персонажем.', 'Effect illustration. In the game, the aura follows your character.')}</p>
    </section><section className="card"><span className={'tag ' + (active ? 'accent' : '')}>{active ? t('Supporter активен', 'Supporter active') : t('Бесплатный аккаунт', 'Free account')}</span><h2>{t('Ваш цвет', 'Your color')}</h2><div className="aura-choices" role="group" aria-label={t('Цвет ауры', 'Aura color')}>{styles.map(style => <button key={style} className={'aura-choice ' + style} aria-pressed={aura === style} onClick={() => setAura(style)}><span/>{style === 'solar' ? t('Солнце', 'Solar') : style === 'lunar' ? t('Луна', 'Lunar') : t('Лес', 'Verdant')}</button>)}</div>
      <p>{t('Аура и статус сторонника на телефоне и ПК. Характеристики, рейтинг и подбор соперников одинаковы для всех.', 'Aura and Supporter status on your phone and PC. Stats, rating and matchmaking stay equal for everyone.')}</p>
      <button className="primary" disabled={!active || busy} onClick={() => void act(async () => { await api('me/supporter/aura', 'PATCH', { aura }); setData(await api<Membership>('me/supporter')); setMessage(t('Аура выбрана. Игра получит обновление от сервера.', 'Aura selected. The game will receive the server update.')); })}>{t('Применить в игре', 'Equip in game')}</button>
      {active && <button disabled={busy} onClick={() => void act(async () => { await api('me/supporter/aura', 'PATCH', { aura: null }); setData(await api<Membership>('me/supporter')); setMessage(t('Аура выключена. Доступ Supporter сохраняется.', 'Aura hidden. Your Supporter access remains active.')); })}>{t('Скрыть ауру', 'Hide aura')}</button>}
      {active && data?.supporter.active_until && <p className="muted">{t('Доступ до', 'Access until')} {date(data.supporter.active_until)}</p>}
      <p><Link href="/devices">{t('Устройства и восстановление аккаунта', 'Devices and account recovery')} →</Link></p>
    </section></div>
    <section className="card"><h2>{t('Поддержать разработку', 'Support development')}</h2><p>{t('Войдите на всех устройствах в этот аккаунт, чтобы использовать одну покупку. Перед оплатой сохраните резервные коды.', 'Use this account on all your devices to share one purchase. Save your recovery codes before paying.')}</p>
      {!data && !error && <p role="status">{t('Загрузка вариантов оплаты…', 'Loading payment options…')}</p>}
      {data && !data.solana.available && <p className="notice">{t('Оплата на сайте пока не подключена. Примерка доступна бесплатно.', 'Website checkout is not available yet. You can preview the styles for free.')}</p>}
      {data?.solana.available && !order && <><p><strong>{data.solana.amount} {data.solana.asset}</strong> · {data.solana.duration_days} {t('дней', 'days')} · {data.solana.network}</p><p className="muted">{t('Предоплата без автоматического продления. Комиссию сети показывает кошелёк.', 'Prepaid access, without automatic renewal. Your wallet shows network fees.')}</p><button className="primary" disabled={busy || active} onClick={() => void act(async () => { setOrder(await api<Order>('me/supporter/solana/checkout', 'POST', {})); setSignature(''); })}>{active ? t('Доступ уже оплачен', 'Access already paid') : t('Оплатить через Solana', 'Pay with Solana')}</button></>}
      {!order && orders.some(o=>o.status==='pending') && <details><summary>{t('Уже оплатили? Найти свой счёт', 'Already paid? Find your order')}</summary><p className="muted">{t('Здесь счета за последние 7 дней. Выберите тот, который оплачивали, и проверьте транзакцию.', 'Orders from the last 7 days. Select the order you paid and verify its transaction.')}</p>{orders.filter(o=>o.status==='pending').map(o=><div className="friend-row" key={o.order_id}><span className="grow">{o.amount} {o.asset} · {new Date(o.expires_at*1000).toLocaleString(locale)}</span><button onClick={()=>{setOrder(o);setSignature('');}}>{t('Проверить этот счёт', 'Check this order')}</button></div>)}</details>}
      {order && <div className="device-confirm"><h3>{t('Счёт для', 'Payment for')} {nickname}</h3><p>{order.amount} {order.asset} · {order.network}</p>{order.network==='devnet'&&<p className="notice">{t('Тестовая сеть: перед оплатой переключите кошелёк на Solana Devnet. Настоящие средства не требуются.', 'Test network: switch your wallet to Solana Devnet before paying. Real funds are not required.')}</p>}<p className="muted">{t('Действует до', 'Expires at')} {new Date(expiry).toLocaleString(locale)}</p>{orderExpired ? <p className="notice">{t('Время оплаты истекло. Если уже оплатили, проверьте транзакцию ниже; не платите повторно.', 'The payment window expired. If you already paid, verify your transaction below; do not pay again.')}</p> : order.payment_url.startsWith('solana:') && <a className="button primary" href={order.payment_url}>{t('Открыть кошелёк', 'Open wallet')} ↗</a>}<form onSubmit={e => { e.preventDefault(); void act(async () => { await api('me/supporter/solana/confirm', 'POST', { order_id: order.order_id, signature: signature.trim() }); setOrder(null); setSignature(''); setData(await api<Membership>('me/supporter')); setMessage(t('Оплата подтверждена. Выберите и примените ауру.', 'Payment confirmed. Choose and equip your aura.')); }); }}><label>{t('Подпись транзакции (необязательно)', 'Transaction signature (optional)')}<input value={signature} onChange={e => setSignature(e.target.value)} maxLength={100} autoComplete="off" spellCheck={false} /></label><button disabled={busy}>{t('Проверить оплату', 'Verify payment')}</button></form><p className="muted">{t('Не отправляйте средства повторно, пока первая транзакция подтверждается.', 'Do not send another payment while your first transaction is confirming.')}</p></div>}
      <p>{t('На iPhone покупка и восстановление покупок доступны внутри игры через App Store, когда они включены для текущей сборки.', 'On iPhone, purchase and restore are available inside the game through the App Store when enabled for the current build.')}</p>
    </section>
    {data && data.supporter.grants.length > 0 && <section className="card"><h2>{t('Ваш доступ', 'Your access')}</h2>{data.supporter.grants.map((grant, i) => <div className="friend-row" key={i}><div className="grow"><strong>{grant.provider === 'apple' ? 'App Store' : grant.provider === 'solana' ? 'Solana' : grant.provider}</strong><small>{date(grant.valid_from)} — {date(grant.valid_until)}</small></div><span className="tag">{grant.revoked ? t('Отозван', 'Revoked') : grant.valid_until * 1000 <= now ? t('Завершён', 'Expired') : grant.renewal_enabled === null ? t('Продление: уточните в App Store', 'Check renewal in App Store') : grant.renewal_enabled ? t('Автопродление', 'Auto-renewal') : t('Без автопродления', 'No auto-renewal')}</span></div>)}<p className="muted">{t('Подпиской App Store управляйте в настройках Apple ID. Отмена продления сохраняет уже оплаченный срок; возврат может прекратить доступ.', 'Manage an App Store subscription in Apple ID settings. Cancelling renewal preserves the paid period; a refund may end access.')}</p></section>}
  </>;
}
