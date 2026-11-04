import type { Locale } from './i18n';

/**
 * The public account-deletion page `/delete` (O-15; launch plan section 7, LR-22) and its
 * footer link. It describes the operator's manual e-mail procedure of the privacy policy
 * (its requests section) until deletion ships in the game and the portal (LR-42, LR-69).
 * No payment-method text belongs here: store builds link this page too (LR-68).
 */
export const deletionTranslations: Record<string, { ru: string; zh: string }> = {
  'Delete account': { ru: 'Удаление аккаунта', zh: '删除账号' },
  'Delete your OMOBA account': { ru: 'Удаление аккаунта OMOBA', zh: '删除 OMOBA 账号' },
  'You can ask us to delete your OMOBA account and the personal data linked to it. You do not need to sign in to read this page or to send the request.': {
    ru: 'Вы можете попросить удалить ваш аккаунт OMOBA и связанные с ним персональные данные. Чтобы прочитать эту страницу и отправить запрос, входить не нужно.',
    zh: '你可以申请删除你的 OMOBA 账号及与其关联的个人数据。阅读本页或发送申请都无需登录。',
  },
  'Until deletion is available in the game and on this site, the operator deletes accounts by hand on request.': {
    ru: 'Пока удаление недоступно в игре и в кабинете игрока, оператор удаляет аккаунты вручную по запросу.',
    zh: '在游戏和本网站提供删除功能之前，运营方会根据申请手动删除账号。',
  },
  'How to request deletion': { ru: 'Как отправить запрос', zh: '如何申请删除' },
  'Write to {email} with the subject “Personal data”.': {
    ru: 'Напишите на {email} с темой «Персональные данные».',
    zh: '发送邮件至 {email}，主题为“个人数据”。',
  },
  'the support e-mail (published before launch)': {
    ru: 'адрес поддержки (будет опубликован до запуска)',
    zh: '支持邮箱（上线前公布）',
  },
  'Give your nickname with its tag (for example Nickname#1234) and say that you want the account deleted.': {
    ru: 'Укажите ник с тегом (например, Nickname#1234) и напишите, что хотите удалить аккаунт.',
    zh: '请写明你的昵称及标签（例如 Nickname#1234），并说明你要删除账号。',
  },
  'We check that the request comes from the account owner, for example by asking you to confirm a sign-in in the game or on this site.': {
    ru: 'Оператор проверяет, что запрос отправил владелец аккаунта: например, просит подтвердить вход через игру или кабинет игрока.',
    zh: '我们会核实申请来自账号所有者，例如请你在游戏或本网站中确认一次登录。',
  },
  'What happens next': { ru: 'Что происходит дальше', zh: '接下来会发生什么' },
  'As soon as the request is confirmed, the account’s device keys are refused: the game can no longer sign in to the account.': {
    ru: 'Как только запрос подтверждён, ключи устройств аккаунта больше не принимаются: игра не сможет войти в этот аккаунт.',
    zh: '申请一经确认，该账号的设备密钥即被拒绝：游戏将无法再登录此账号。',
  },
  'Erasure is completed within 30 days: sign-in sessions and linked accounts are revoked; friends, settings, recovery codes, class builds and feedback texts are deleted; your nickname is replaced with “Deleted player” in the profile and in match history.': {
    ru: 'Удаление завершается в срок не более 30 дней: сессии и привязанные учётные записи для входа отзываются; друзья, настройки, резервные коды, сборки классов и тексты отзывов удаляются; ник заменяется на «Удалённый игрок» в профиле и в истории матчей.',
    zh: '删除将在 30 天内完成：撤销登录会话和已关联的登录账号；删除好友、设置、恢复码、职业构筑和反馈内容；在个人资料和比赛记录中，你的昵称将替换为“已删除的玩家”。',
  },
  'Match results stay in anonymised form so that other players’ ratings do not change.': {
    ru: 'Результаты матчей остаются в обезличенном виде, чтобы не менять рейтинг других игроков.',
    zh: '比赛结果将以匿名形式保留，以免影响其他玩家的排位分。',
  },
  'The procedure and how long each kind of data is kept are set out in {privacy}.': {
    ru: 'Порядок удаления и сроки хранения данных установлены {privacy}.',
    zh: '删除流程及各类数据的保存期限见{privacy}。',
  },
};

/** Server-side text (metadata) in the page language. */
export function deletionText(locale: Locale, source: string): string {
  return locale === 'en' ? source : deletionTranslations[source]?.[locale] ?? source;
}
