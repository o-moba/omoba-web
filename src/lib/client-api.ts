export class ApiFailure extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

/** Credentials remain in HttpOnly cookies; every mutation gets an origin-bound CSRF proof. */
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const csrf = await fetch('/api/csrf', { cache: 'no-store' });
    if (!csrf.ok) throw new ApiFailure('unavailable', 503);
    headers['X-CSRF-Token'] = (await csrf.json()).token;
    headers['Content-Type'] = 'application/json';
    headers['Idempotency-Key'] = crypto.randomUUID();
  }
  const response = await fetch('/api/' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
  });
  const value = await response.json();
  if (!response.ok) throw new ApiFailure(value.code || 'failed', response.status);
  return value;
}

export function accountError(error: unknown, ru: boolean): string {
  if (error instanceof ApiFailure) {
    if (error.code === 'fresh_confirmation_required') return ru ? 'Подтвердите вход через игру заново: для этого действия нужен вход за последние 10 минут.' : 'Confirm sign-in through the game again. This action needs a login within the last 10 minutes.';
    if (error.code === 'recovery_required_before_last_device') return ru ? 'Сначала создайте резервные коды или подключите другое устройство.' : 'Generate recovery codes or connect another device first.';
    if (error.code === 'device_limit') return ru ? 'Достигнут лимит устройств. Отключите неиспользуемое устройство.' : 'Device limit reached. Revoke an unused device first.';
    if (error.status === 401) return ru ? 'Войдите в аккаунт заново.' : 'Sign in again.';
    if (error.status === 429) return ru ? 'Слишком много запросов. Подождите немного.' : 'Too many requests. Please wait.';
    if (error.status === 503) return ru ? 'Сервис временно недоступен. Попробуйте позднее.' : 'The service is temporarily unavailable. Please try later.';
    if (error.code === 'payment_invalid') return ru ? 'Подходящая подтверждённая оплата пока не найдена. Проверьте сеть, сумму и повторите проверку через минуту. Не платите повторно.' : 'A matching finalized payment was not found yet. Check the network and amount, then retry in a minute. Do not pay again.';
    if (error.code === 'already_supported') return ru ? 'Доступ уже оплачен или подписка Apple ещё продлевается. Проверьте её статус перед новой оплатой.' : 'Access is already paid or your Apple subscription is still renewing. Check its status before paying again.';
    if (error.code === 'supporter_required') return ru ? 'Для применения ауры нужен действующий Supporter.' : 'An active Supporter membership is required to equip an aura.';
    if (error.status === 409) return ru ? 'Состояние изменилось или действие уже выполнено. Обновите страницу.' : 'The state changed or this action was already completed. Refresh the page.';
  }
  return ru ? 'Не удалось выполнить действие. Проверьте данные и повторите.' : 'The action failed. Check the details and try again.';
}
