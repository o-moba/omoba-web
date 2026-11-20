/**
 * The Supporter page of a market that sells Hero tiers through YooKassa (LR-67, RU):
 * tier cards, the payment form, the return state, the step-down and the history.
 * Style names come from the game (`AURA_NAMES` in hero-tiers.mjs), not from here.
 * RU pages carry no Solana, Apple, crypto, wallet or Ekza text (tests/hero-tiers.test.mjs).
 */
export const heroTierTranslations: Record<string, { ru: string; zh: string }> = {
  'SUPPORT OMOBA · HERO': { ru: 'ПОДДЕРЖКА OMOBA · HERO', zh: '支持 OMOBA · 英雄' },
  'Light up your hero.': { ru: 'Пусть ваш герой сияет.', zh: '让你的英雄闪耀。' },
  'Support OMOBA voluntarily. Each payment gives your hero an aura for 30 days that every player in your matches sees. It changes appearance only: stats, rating and matchmaking stay equal for everyone.': {
    ru: 'Поддержите OMOBA добровольно. Каждый платёж даёт вашему герою ауру на 30 дней, которую видят все игроки в ваших матчах. Меняется только внешний вид: характеристики, рейтинг и подбор игроков одинаковы для всех.',
    zh: '自愿支持 OMOBA。每次付款都会让你的英雄获得 30 天光环，同场比赛的所有玩家都能看到。光环只改变外观：属性、评分和匹配对所有人相同。',
  },
  'Checking your payment…': { ru: 'Проверяем оплату…', zh: '正在确认付款…' },
  'Do not pay again.': { ru: 'Не оплачивайте повторно.', zh: '请勿重复付款。' },
  'Payment received. Thank you! Your aura is active; the game shows it with the next server update.': {
    ru: 'Оплата получена. Спасибо! Аура активна, игра покажет её со следующим обновлением с сервера.',
    zh: '已收到付款，谢谢！光环已生效，游戏会在下次服务器更新时显示。',
  },
  'The payment was not completed, and no money was taken. You can choose an amount and try again.': {
    ru: 'Платёж не завершён, деньги не списаны. Можно выбрать сумму и попробовать снова.',
    zh: '付款未完成，未扣款。你可以选择金额后重试。',
  },
  'Your payment needs a manual check by the operator. Do not pay again; the aura appears once it is confirmed.': {
    ru: 'Платёж проверяет оператор вручную. Не оплачивайте повторно: аура появится после подтверждения.',
    zh: '你的付款需要运营方人工核对。请勿重复付款；确认后光环会出现。',
  },
  'Sign in to see whether your payment went through. Do not pay again.': {
    ru: 'Войдите, чтобы увидеть, прошёл ли платёж. Не оплачивайте повторно.',
    zh: '请登录查看付款是否成功。请勿重复付款。',
  },
  'Your payment is still being confirmed.': { ru: 'Платёж ещё подтверждается.', zh: '付款仍在确认中。' },
  'Do not pay again: the aura appears by itself as soon as the payment is confirmed. Check your history in a few minutes.': {
    ru: 'Не оплачивайте повторно: аура появится сама, как только платёж подтвердится. Загляните в историю платежей через несколько минут.',
    zh: '请勿重复付款：付款确认后光环会自动出现。几分钟后可查看付款记录。',
  },
  'Your Hero status could not be loaded. Please try again.': {
    ru: 'Не удалось загрузить статус Hero. Попробуйте ещё раз.',
    zh: '无法加载英雄状态，请重试。',
  },
  'Your Hero': { ru: 'Ваш Hero', zh: '你的英雄状态' },
  'No active payment': { ru: 'Нет действующего платежа', zh: '没有生效中的付款' },
  'Your tier is {tier} until {until}.': { ru: 'Ваш уровень — {tier} до {until}.', zh: '你的等级为{tier}，有效至 {until}。' },
  'Then {tier} until {until}.': { ru: 'Затем {tier} до {until}.', zh: '之后为{tier}，有效至 {until}。' },
  'Hero is active until {until}. Payments from 100 ₽ within 30 days unlock a tier aura.': {
    ru: 'Hero активен до {until}. Платежи от 100 ₽ за 30 дней открывают ауру уровня.',
    zh: '英雄资格有效至 {until}。30 天内付款满 100 ₽ 即可解锁等级光环。',
  },
  'You have no active payment. Each payment lasts 30 days.': {
    ru: 'Действующего платежа нет. Каждый платёж действует 30 дней.',
    zh: '你目前没有生效中的付款。每次付款有效 30 天。',
  },
  'Your aura': { ru: 'Ваша аура', zh: '你的光环' },
  'from {amount} within 30 days': { ru: 'от {amount} за 30 дней', zh: '30 天内满 {amount}' },
  'Aura selected. The game receives it with the next server update.': {
    ru: 'Аура выбрана. Игра получит её со следующим обновлением с сервера.',
    zh: '已选择光环。游戏会在下次服务器更新时收到。',
  },
  'Aura hidden. Your Hero tier stays active.': { ru: 'Аура скрыта. Уровень Hero сохраняется.', zh: '光环已隐藏，英雄等级仍然有效。' },
  'Your current tier does not include this aura yet.': { ru: 'Эта аура пока не входит в ваш уровень.', zh: '你当前的等级尚未包含此光环。' },
  'An active Hero payment is required to equip an aura.': { ru: 'Чтобы применить ауру, нужен действующий платёж Hero.', zh: '需要生效中的英雄付款才能装备光环。' },
  'Hero tiers': { ru: 'Уровни Hero', zh: '英雄等级' },
  'Each payment lasts 30 days. All your payments within those 30 days add up to a higher tier: {small} every month keeps {rose}, {large} every month keeps {crimson}. Any active payment also unlocks the {solar}, {lunar} and {verdant} auras.': {
    ru: 'Каждый платёж действует 30 дней. Все ваши платежи за эти 30 дней складываются в более высокий уровень: {small} каждый месяц сохраняют уровень «{rose}», {large} каждый месяц — «{crimson}». Любой действующий платёж также открывает ауры «{solar}», «{lunar}» и «{verdant}».',
    zh: '每次付款有效 30 天。30 天内的所有付款会累计成更高等级：每月 {small} 保持「{rose}」，每月 {large} 保持「{crimson}」。任何生效中的付款还会解锁「{solar}」「{lunar}」「{verdant}」光环。',
  },
  'Amount': { ru: 'Сумма', zh: '金额' },
  'aura for 30 days': { ru: 'аура на 30 дней', zh: '30 天光环' },
  'Your amount': { ru: 'Своя сумма', zh: '自定义金额' },
  'Your amount in rubles': { ru: 'Своя сумма в рублях', zh: '自定义金额（卢布）' },
  'from {min} to {max}, whole rubles': { ru: 'от {min} до {max}, целыми рублями', zh: '{min} 至 {max}，整数卢布' },
  'Choose a whole amount from 100 to 100 000 ₽.': { ru: 'Выберите сумму целыми рублями от 100 до 100 000 ₽.', zh: '请选择 100 至 100 000 ₽ 之间的整数金额。' },
  '{amount} · aura for {days} days · this payment alone reaches {tier}': {
    ru: '{amount} · аура на {days} дней · этот платёж сам по себе даёт уровень {tier}',
    zh: '{amount} · 光环 {days} 天 · 仅此一笔即可达到{tier}',
  },
  'Payments are not open yet. You can already look at the tiers.': {
    ru: 'Платежи пока не открыты. Уровни уже можно посмотреть.',
    zh: '付款尚未开放。你可以先查看各个等级。',
  },
  'Payments are paused for a short while. Please try again later.': {
    ru: 'Платежи ненадолго приостановлены. Попробуйте позже.',
    zh: '付款暂时暂停，请稍后再试。',
  },
  'E-mail for the receipt': { ru: 'E-mail для чека', zh: '接收收据的电子邮箱' },
  'The fiscal receipt (54-FZ) is sent to this address. It is used only for the receipt.': {
    ru: 'Кассовый чек (54-ФЗ) придёт на этот адрес. Адрес используется только для чека.',
    zh: '电子收据（俄罗斯 54-FZ 法规）将发送到此地址，该地址仅用于收据。',
  },
  'I have read and accept {offer}.': { ru: 'Я ознакомился и принимаю {offer}.', zh: '我已阅读并接受{offer}。' },
  'the public offer': { ru: 'публичную оферту', zh: '公开要约' },
  'Continue to payment': { ru: 'Перейти к оплате', zh: '前往付款' },
  'Pay {amount}': { ru: 'Оплатить {amount}', zh: '支付 {amount}' },
  'You pay on the YooKassa page and come back here afterwards. One payment, no automatic renewal.': {
    ru: 'Оплата проходит на странице ЮKassa, затем вы вернётесь сюда. Разовый платёж, без автоматического продления.',
    zh: '你将在 YooKassa 页面付款，完成后返回此处。一次性付款，不会自动续费。',
  },
  'Payments open soon. You can already read the prices and {offer}; you will pay on the YooKassa page. One payment for 30 days, no automatic renewal; the aura appears on your hero once the payment is confirmed.': {
    ru: 'Оплата скоро откроется. Уже можно посмотреть цены и {offer}; оплата пройдёт на странице ЮKassa. Разовый платёж на 30 дней без автоматического продления; аура появляется у героя после подтверждения оплаты.',
    zh: '付款即将开放。你现在已可查看价格和{offer}；届时将在 YooKassa 页面付款。一次性付款，有效 30 天，不会自动续费；付款确认后光环即出现在你的英雄身上。',
  },
  'Sign in to support': { ru: 'Войти и поддержать', zh: '登录后支持' },
  'Prices and {offer} are open to everyone; paying needs your OMOBA account so that the aura reaches your hero.': {
    ru: 'Цены и {offer} открыты для всех; для оплаты нужен аккаунт OMOBA, чтобы аура досталась вашему герою.',
    zh: '价格和{offer}对所有人公开；付款需要登录 OMOBA 账号，光环才能发放到你的英雄。',
  },
  'Your payments': { ru: 'Ваши платежи', zh: '你的付款' },
  'refunded {amount}': { ru: 'возвращено {amount}', zh: '已退款 {amount}' },
  'Paid': { ru: 'Оплачен', zh: '已支付' },
  'Not completed': { ru: 'Не завершён', zh: '未完成' },
  'Manual check': { ru: 'Ручная проверка', zh: '人工核对' },
  'Being confirmed': { ru: 'Подтверждается', zh: '确认中' },
  'A refunded amount no longer counts towards your tier.': { ru: 'Возвращённая сумма больше не учитывается в уровне.', zh: '已退款的金额不再计入你的等级。' },
  'The price or period changed. We reloaded the offer: check the amount and confirm again.': {
    ru: 'Цена или срок изменились. Мы обновили условия: проверьте сумму и подтвердите ещё раз.',
    zh: '价格或期限已变更。我们已重新加载条款：请核对金额后再次确认。',
  },
  'Enter a valid e-mail for the receipt.': { ru: 'Укажите корректный e-mail для чека.', zh: '请输入有效的收据邮箱。' },
  'This payment is still being processed. Wait a minute and check your history; do not pay again.': {
    ru: 'Этот платёж ещё обрабатывается. Подождите минуту и проверьте историю платежей; не оплачивайте повторно.',
    zh: '此付款仍在处理中。请稍候一分钟并查看付款记录；请勿重复付款。',
  },
  'Your previous payment of this amount has already gone through. Press the button again to make a new payment.': {
    ru: 'Предыдущий платёж на эту сумму уже прошёл. Нажмите кнопку ещё раз, чтобы сделать новый платёж.',
    zh: '你之前这笔相同金额的付款已经成功。如需再次付款，请再次点击按钮。',
  },
  'Your previous payment of this amount was not completed. Press the button again to start a new payment.': {
    ru: 'Предыдущий платёж на эту сумму не завершён. Нажмите кнопку ещё раз, чтобы начать новый платёж.',
    zh: '你之前这笔相同金额的付款未完成。请再次点击按钮发起新的付款。',
  },
  'Your previous payment needs a manual check by the operator. Do not pay again; write to support if the aura does not appear within a day.': {
    ru: 'Предыдущий платёж проверяет оператор вручную. Не оплачивайте повторно; если аура не появится в течение суток, напишите в поддержку.',
    zh: '你之前的付款需要运营方人工核对。请勿重复付款；如一天内光环仍未出现，请联系支持。',
  },
  'You have too many unfinished payments today. Finish one of them or try again tomorrow.': {
    ru: 'Сегодня у вас слишком много незавершённых платежей. Завершите один из них или попробуйте завтра.',
    zh: '你今天有太多未完成的付款。请先完成其中一笔，或明天再试。',
  },
  'Check the amount, the e-mail and the offer, then try again.': {
    ru: 'Проверьте сумму, e-mail и согласие с офертой и попробуйте снова.',
    zh: '请检查金额、邮箱和要约确认后重试。',
  },
  'The payment could not be started. Check the details and try again.': {
    ru: 'Не удалось начать платёж. Проверьте данные и попробуйте снова.',
    zh: '无法发起付款。请检查信息后重试。',
  },
};
