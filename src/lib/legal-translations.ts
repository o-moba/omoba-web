// Strings of the legal links, sign-in notice and document pages (LR-06). The
// documents themselves are Russian (legal/<market>/<version>/*.md).
export const legalTranslations: Record<string, { ru: string; zh: string }> = {
  'Privacy policy': { ru: 'Политика конфиденциальности', zh: '隐私政策' },
  'Terms of use': { ru: 'Пользовательское соглашение', zh: '用户协议' },
  'Public offer': { ru: 'Оферта', zh: '公开要约' },
  'Support': { ru: 'Поддержка', zh: '支持' },
  'Source code': { ru: 'Исходный код', zh: '源代码' },
  'VK community': { ru: 'Сообщество VK', zh: 'VK 社区' },
  'Legal information and support': { ru: 'Правовая информация и поддержка', zh: '法律信息与支持' },
  'By signing in, you accept {terms} and agree to the processing of your personal data under {privacy}.': {
    ru: 'Входя, вы принимаете {terms} и соглашаетесь на обработку персональных данных в соответствии с {privacy}.',
    zh: '登录即表示你接受{terms}，并同意按照{privacy}处理你的个人数据。',
  },
  'the Terms of Use': { ru: 'Пользовательское соглашение', zh: '《用户协议》' },
  'the Privacy Policy': { ru: 'Политикой обработки персональных данных', zh: '《隐私政策》' },
  'This document is available in Russian only.': { ru: 'Документ доступен только на русском языке.', zh: '本文件仅提供俄语版本。' },
  'Source code of this version': { ru: 'Исходный код этой версии', zh: '此版本的源代码' },
};
