const ru = {
  overview:'Обзор', matches:'Матчи', players:'Игроки', friends:'Друзья', profile:'Профиль', stats:'Статистика', settings:'Настройки', download:'Скачать игру',
  title:'Твоя игра. В деталях.', intro:'Результаты матчей, прогресс и люди, с которыми хочется играть снова.',
  friendSearchHelp:'Ник друга и четыре цифры после #',handleTaken:'Такой ник и тег уже заняты. Выбери другие четыре цифры.',playerNotFound:'Игрок не найден. Проверь ник и четыре цифры после #.',handleHelp:'От 1 до 20 символов в имени, затем # и ровно 4 цифры. Ник и цифры можно менять.',
  login:'Войти через игру', logout:'Выйти', refresh:'Обновить', retry:'Повторить', loading:'Загружаем…',
  empty:'Здесь пока пусто', noMatches:'Сохранённых матчей пока нет. Тренировки с ботами не записываются в карьеру.',
  unavailable:'Сервис аккаунтов сейчас недоступен. Попробуй ещё раз немного позже.', private:'Страница не найдена или доступ к ней ограничен.',
  loginNeeded:'Войди, чтобы посмотреть свой аккаунт и результаты.', createPair:'Получить код',
  pairHelp:'Открой в игре «Profile → Connect website», введи этот код и подтверди свой аккаунт. Подтверждай только код со своего браузера.',
  awaiting:'Ожидаем подтверждение в игре', expired:'Код истёк или был отменён. Получи новый.', denied:'Вход отклонён в игре.', cancel:'Отменить',
  pairingIntro:'Подключите свой игровой аккаунт. Портал сможет управлять устройствами, резервными кодами, косметикой, друзьями и настройками профиля. Приватный ключ остаётся на устройстве.',
  newPlayer:'Ещё не играл? Установи клиент и создай игровой профиль на сервере с сохранением прогресса.',
  level:'Уровень', rating:'Рейтинг', wins:'Победы', losses:'Поражения', winRate:'Доля побед', ratedMatches:'Рейтинговые матчи', newcomer:'Новичок',
  latest:'Последние матчи', allMatches:'Вся история', victory:'Победа', defeat:'Поражение', interrupted:'Прерван', abandoned:'Не завершён',
  rated:'Рейтинговые', unrated:'Не рейтинговые', all:'Все', hero:'Класс', period:'Период', days:'дней', allTime:'Всё время', outcome:'Исход',
  duration:'Длительность', damage:'Урон героям', structures:'Урон строениям', creeps:'Урон существам', taken:'Полученный урон',
  minions:'Добивания миньонов', jungle:'Лесные добивания', towers:'Уничтожено строений', finalLevel:'Уровень в матче',
  dmgMinute:'Урон героям / мин', sample:'Матчей в выборке', smallSample:'Мало данных: меньше 5 матчей. Результаты пока не показывают устойчивую тенденцию.',
  updating:'Статистика обновляется', asOf:'Данные на', byClass:'По классам', ratingHistory:'Изменение рейтинга',
  next:'Дальше', previous:'Назад', open:'Открыть', search:'Найти', searchHelp:'Точный ник#1234 или ник публичного профиля',
  friendCode:'Твой ник и тег', copy:'Скопировать', copied:'Скопировано', incoming:'Входящие', outgoing:'Отправленные', addFriend:'Добавить в друзья',
  accept:'Принять', reject:'Отклонить', remove:'Удалить', online:'Онлайн в клиенте', playing:'В игре', offline:'Не в сети', unknown:'Статус неизвестен',
  nickname:'Ник и тег', save:'Сохранить', saved:'Сохранено', privacy:'Публичность профиля', publicProfile:'Публичная карточка', publicStats:'Публиковать сводную статистику', discoverable:'Находить меня по нику',
  privacyHelp:'История матчей и друзья остаются приватными. По точному нику#тегу тебя можно добавить в друзья; поиск по части ника включается отдельно. Игровые контакты имеют доступ к базовым показателям.',
  language:'Язык', timezone:'Часовой пояс', sessions:'Веб-сессии', currentSession:'Текущая', revoke:'Завершить сессию',
  revokeHelp:'Для завершения других сессий повторно подтверди вход через игру в течение последних 10 минут.',
  downloadsTitle:'Продолжи в игре', downloadsHelp:'Здесь появляются только опубликованные и проверенные сборки.', noRelease:'Публичные сборки пока не опубликованы.',
  noReward:'Этот матч не изменяет рейтинг', historical:'Имена и образы сохранены такими, какими они были в этом матче.',
  bot:'Бот', disconnected:'Отключился', team:'Команда', loadError:'Не удалось выполнить действие. Обнови страницу и попробуй ещё раз.',
  conflict:'Данные изменились. Обнови страницу перед повтором.', rateLimited:'Слишком много запросов. Подожди немного.',
  freshLogin:'Нужно заново подтвердить вход через игру.', kdaHelp:'KDA = сумма убийств и помощи / максимум из 1 и суммы смертей.',
  account:'Аккаунт игрока', contacts:'Контакт', public:'Публичный профиль', limitedStats:'Владелец не опубликовал статистику.',
};
const en: typeof ru = {
  overview:'Overview',matches:'Matches',players:'Players',friends:'Friends',profile:'Profile',stats:'Statistics',settings:'Settings',download:'Get the game',
  friendSearchHelp:'Friend nickname and four digits after #',handleTaken:'This nickname and tag are taken. Choose another four digits.',playerNotFound:'Player not found. Check the name and four-digit tag.',handleHelp:'Use 1–20 name characters, then # and exactly 4 digits. Both can be changed.',
  title:'Your game. In detail.',intro:'Match results, your progress, and the people you want to play with again.',login:'Connect your game',logout:'Sign out',refresh:'Refresh',retry:'Try again',loading:'Loading…',
  empty:'Nothing here yet',noMatches:'No saved matches yet. Finish a match on a server with saved progression. Local practice is not recorded.',unavailable:'The account service is unavailable. Please try again shortly.',private:'This page does not exist or is private.',loginNeeded:'Sign in to see your account and results.',createPair:'Get a code',
  pairHelp:'Open “Profile → Connect website” in the game, enter this code and confirm your account. Only approve a code from your own browser.',awaiting:'Waiting for confirmation in the game',expired:'This code expired or was cancelled. Get a new one.',denied:'Sign-in was declined in the game.',cancel:'Cancel',pairingIntro:'Use your existing game account. The portal can manage devices, recovery codes, cosmetics, friends and profile settings. Your private key stays on your device.',newPlayer:'New player? Install the client and create a game profile on a server with saved progression.',
  level:'Level',rating:'Rating',wins:'Wins',losses:'Losses',winRate:'Win rate',ratedMatches:'Rated matches',newcomer:'Newcomer',latest:'Recent matches',allMatches:'Match history',victory:'Victory',defeat:'Defeat',interrupted:'Interrupted',abandoned:'Abandoned',rated:'Rated',unrated:'Unrated',all:'All',hero:'Class',period:'Period',days:'days',allTime:'All time',outcome:'Outcome',duration:'Duration',damage:'Hero damage',structures:'Structure damage',creeps:'Creep damage',taken:'Damage taken',minions:'Minion last hits',jungle:'Jungle last hits',towers:'Structures destroyed',finalLevel:'Match level',dmgMinute:'Hero damage / min',sample:'Matches in sample',smallSample:'Small sample: fewer than 5 matches. Results do not establish a reliable trend yet.',updating:'Statistics are updating',asOf:'As of',byClass:'By class',ratingHistory:'Rating changes',next:'Next',previous:'Back',open:'Open',search:'Find',searchHelp:'Exact nickname#1234 or a discoverable nickname',friendCode:'Your player tag',copy:'Copy',copied:'Copied',incoming:'Incoming',outgoing:'Sent',addFriend:'Add friend',accept:'Accept',reject:'Decline',remove:'Remove',online:'Online in client',playing:'Playing',offline:'Offline',unknown:'Unknown status',nickname:'Player tag',save:'Save',saved:'Saved',privacy:'Profile visibility',publicProfile:'Public profile card',publicStats:'Publish summary statistics',discoverable:'Find me by nickname',privacyHelp:'Your match history and friends remain private. An exact nickname#tag can be used to add you; partial-name discovery is separate. Game contacts can view basic profile statistics.',language:'Language',timezone:'Time zone',sessions:'Browser sessions',currentSession:'Current',revoke:'End session',revokeHelp:'To revoke other sessions, confirm sign-in through the game again within the last 10 minutes.',downloadsTitle:'Continue in the game',downloadsHelp:'Only published and verified builds appear here.',noRelease:'Public downloads have not been published yet.',noReward:'This match does not change your rating',historical:'Names and appearances are preserved as they were in this match.',bot:'Bot',disconnected:'Disconnected',team:'Team',loadError:'The action could not be completed. Refresh and try again.',conflict:'The data changed. Refresh before trying again.',rateLimited:'Too many requests. Please wait a moment.',freshLogin:'Confirm sign-in through the game again.',kdaHelp:'KDA = total kills plus assists / max(1, total deaths).',account:'Player account',contacts:'Contact',public:'Public profile',limitedStats:'This player has not published their statistics.',
};
const zh: typeof ru = {
  "overview": "概览",
  "matches": "比赛",
  "players": "玩家",
  "friends": "好友",
  "profile": "个人资料",
  "stats": "统计",
  "settings": "设置",
  "download": "下载游戏",
  "title": "你的游戏，一目了然。",
  "intro": "查看比赛结果、成长进度，以及想再次并肩作战的伙伴。",
  "friendSearchHelp": "好友昵称及 # 后的四位数字",
  "handleTaken": "此昵称和标签已被使用，请更换四位数字。",
  "playerNotFound": "未找到玩家，请检查昵称和四位数字标签。",
  "handleHelp": "昵称长度为 1–20 个字符，后接 # 和四位数字。昵称和数字均可修改。",
  "login": "连接游戏账号",
  "logout": "退出登录",
  "refresh": "刷新",
  "retry": "重试",
  "loading": "加载中…",
  "empty": "暂无内容",
  "noMatches": "暂无已保存的比赛。请在支持进度保存的服务器完成一场比赛。本地练习不会记录。",
  "unavailable": "账号服务暂时不可用，请稍后重试。",
  "private": "页面不存在或无权访问。",
  "loginNeeded": "登录后查看账号和比赛结果。",
  "createPair": "获取连接码",
  "pairHelp": "在游戏中打开“个人资料 → 连接网站”，输入此连接码并确认账号。只批准来自你自己浏览器的连接码。",
  "awaiting": "等待在游戏中确认",
  "expired": "连接码已过期或取消，请获取新码。",
  "denied": "已在游戏中拒绝登录。",
  "cancel": "取消",
  "pairingIntro": "连接现有游戏账号，管理设备、恢复码、外观、好友和个人设置。私钥始终保留在你的设备上。",
  "newPlayer": "新玩家？安装客户端，并在支持进度保存的服务器创建游戏档案。",
  "level": "等级",
  "rating": "评分",
  "wins": "胜场",
  "losses": "败场",
  "winRate": "胜率",
  "ratedMatches": "排位赛",
  "newcomer": "新玩家",
  "latest": "最近比赛",
  "allMatches": "比赛记录",
  "victory": "胜利",
  "defeat": "失败",
  "interrupted": "已中断",
  "abandoned": "未完成",
  "rated": "排位赛",
  "unrated": "非排位赛",
  "all": "全部",
  "hero": "职业",
  "period": "时间范围",
  "days": "天",
  "allTime": "全部时间",
  "outcome": "结果",
  "duration": "时长",
  "damage": "英雄伤害",
  "structures": "建筑伤害",
  "creeps": "野怪伤害",
  "taken": "承受伤害",
  "minions": "小兵补刀",
  "jungle": "野怪补刀",
  "towers": "摧毁建筑",
  "finalLevel": "本场等级",
  "dmgMinute": "每分钟英雄伤害",
  "sample": "样本比赛数",
  "smallSample": "样本较少：不足 5 场比赛，结果尚不能反映稳定趋势。",
  "updating": "统计正在更新",
  "asOf": "数据更新于",
  "byClass": "按职业",
  "ratingHistory": "评分变化",
  "next": "下一页",
  "previous": "返回",
  "open": "打开",
  "search": "查找",
  "searchHelp": "输入完整的昵称#1234，或已开放搜索的昵称",
  "friendCode": "你的玩家标签",
  "copy": "复制",
  "copied": "已复制",
  "incoming": "收到的请求",
  "outgoing": "已发送",
  "addFriend": "添加好友",
  "accept": "接受",
  "reject": "拒绝",
  "remove": "移除",
  "online": "客户端在线",
  "playing": "游戏中",
  "offline": "离线",
  "unknown": "状态未知",
  "nickname": "玩家昵称和标签",
  "save": "保存",
  "saved": "已保存",
  "privacy": "个人资料可见性",
  "publicProfile": "公开个人资料卡",
  "publicStats": "公开汇总统计",
  "discoverable": "允许通过昵称找到我",
  "privacyHelp": "比赛记录和好友列表保持私密。其他玩家可通过完整的昵称#标签添加你；部分昵称搜索需单独开启。游戏好友可查看基本统计数据。",
  "language": "语言",
  "timezone": "时区",
  "sessions": "浏览器会话",
  "currentSession": "当前会话",
  "revoke": "结束会话",
  "revokeHelp": "结束其他会话前，需在最近 10 分钟内通过游戏重新确认登录。",
  "downloadsTitle": "前往游戏继续",
  "downloadsHelp": "这里仅展示已发布并验证的版本。",
  "noRelease": "暂无公开下载版本。",
  "noReward": "本场比赛不影响评分",
  "historical": "本场比赛保留当时使用的昵称和外观。",
  "bot": "机器人",
  "disconnected": "已断线",
  "team": "队伍",
  "loadError": "操作未完成，请刷新页面后重试。",
  "conflict": "数据已变化，请刷新后重试。",
  "rateLimited": "请求过于频繁，请稍候。",
  "freshLogin": "请通过游戏重新确认登录。",
  "kdaHelp": "KDA =（总击杀数 + 总助攻数）/ 最大值（1，总死亡数）。",
  "account": "玩家账号",
  "contacts": "游戏好友",
  "public": "公开个人资料",
  "limitedStats": "该玩家尚未公开统计数据。"
};
export const dictionaries = { ru, en, zh };
export type Locale = keyof typeof dictionaries;
export type Words = typeof ru;
const supplementalTranslations: Record<string, { ru: string; zh: string }> = {
  "Community sculptures": { ru: "Скульптуры сообщества", zh: "社区雕塑" },
  "Market": {
    "ru": "Маркет",
    "zh": "市场"
  },
  "One account. Every device.": {
    "ru": "Один аккаунт. Все устройства.",
    "zh": "一个账号，所有设备。"
  },
  "Keep your progress and cosmetics on your phone and computer.": {
    "ru": "Прогресс и косметика остаются с вами на телефоне и компьютере.",
    "zh": "在手机和电脑上保留进度与外观。"
  },
  "Connect a device": {
    "ru": "Подключить устройство",
    "zh": "连接设备"
  },
  "On the new device, open Profile → account linking and get a code. Enter it here. Only approve your own device.": {
    "ru": "На новом устройстве откройте профиль → подключение аккаунта и получите код. Введите его здесь. Подтверждайте только собственное устройство.",
    "zh": "在新设备中打开“个人资料 → 账号连接”并获取连接码，在此输入。只批准你自己的设备。"
  },
  "Code from your new device": {
    "ru": "Код с нового устройства",
    "zh": "新设备上的连接码"
  },
  "Review device": {
    "ru": "Проверить устройство",
    "zh": "检查设备"
  },
  "Confirm account link": {
    "ru": "Подтвердите привязку",
    "zh": "确认账号连接"
  },
  "Will get access to": {
    "ru": "Получит доступ к аккаунту",
    "zh": "将获得此账号的访问权限："
  },
  "Compare the key fingerprint on your new device. Its previous profile will not be merged with this account.": {
    "ru": "Сверьте отпечаток ключа с новым устройством. Его прежний профиль не объединяется с этим аккаунтом.",
    "zh": "请核对新设备上的密钥指纹。该设备原有的档案不会合并到此账号。"
  },
  "Expires at": {
    "ru": "Действует до",
    "zh": "到期时间"
  },
  "Link approved. Complete it on your new device.": {
    "ru": "Привязка разрешена. Завершите её на новом устройстве.",
    "zh": "连接已批准，请在新设备上完成。"
  },
  "Allow access": {
    "ru": "Разрешить доступ",
    "zh": "允许访问"
  },
  "Cancel": {
    "ru": "Отмена",
    "zh": "取消"
  },
  "Your devices": {
    "ru": "Ваши устройства",
    "zh": "你的设备"
  },
  "Loading…": {
    "ru": "Загрузка…",
    "zh": "加载中…"
  },
  "Revoked": {
    "ru": "Отозван",
    "zh": "已撤销"
  },
  "Revoke this device? Browser sessions will also end. Make sure you have another device or recovery code.": {
    "ru": "Отключить это устройство? Веб-сеансы тоже завершатся. Убедитесь, что есть другое устройство или резервный код.",
    "zh": "撤销此设备？浏览器会话也会结束。请确认你有其他设备或恢复码。"
  },
  "Revoke": {
    "ru": "Отключить",
    "zh": "撤销"
  },
  "Account recovery": {
    "ru": "Восстановление доступа",
    "zh": "账号恢复"
  },
  "Save recovery codes in your password manager. Each code works once in the game if you lose access to your devices. A nickname alone cannot recover an account. After recovery, revoke lost devices in the list above.": {
    "ru": "Сохраните резервные коды в менеджере паролей. Каждый код можно использовать один раз в игре, если потеряете доступ к устройствам. Никнейм сам по себе не восстанавливает аккаунт. После восстановления отключите потерянные устройства в списке выше.",
    "zh": "请将恢复码保存在密码管理器中。无法访问设备时，每个恢复码可在游戏中使用一次。仅凭昵称无法恢复账号。恢复后，请在上方列表撤销丢失的设备。"
  },
  "Codes remaining:": {
    "ru": "Осталось кодов:",
    "zh": "剩余恢复码："
  },
  "These codes are shown only now. Do not share them.": {
    "ru": "Коды показаны только сейчас. Никому их не отправляйте.",
    "zh": "恢复码仅在此时显示，请勿分享给任何人。"
  },
  "Recovery codes": {
    "ru": "Резервные коды",
    "zh": "恢复码"
  },
  "Codes copied. Save them somewhere safe.": {
    "ru": "Коды скопированы. Сохраните их в надёжном месте.",
    "zh": "恢复码已复制，请妥善保存。"
  },
  "Select and copy the codes manually.": {
    "ru": "Выделите и скопируйте коды вручную.",
    "zh": "请手动选中并复制恢复码。"
  },
  "Copy codes": {
    "ru": "Скопировать коды",
    "zh": "复制恢复码"
  },
  "I saved my codes — hide": {
    "ru": "Я сохранил коды — скрыть",
    "zh": "已保存恢复码，隐藏"
  },
  "New codes replace all previous codes. Continue?": {
    "ru": "Новые коды заменят все предыдущие. Продолжить?",
    "zh": "新恢复码将使所有旧码失效，是否继续？"
  },
  "Generate recovery codes": {
    "ru": "Создать резервные коды",
    "zh": "生成恢复码"
  },
  "Let your hero shine.": {
    "ru": "Пусть герой сияет.",
    "zh": "让你的英雄闪耀。"
  },
  "Support an open game. Choose your own light.": {
    "ru": "Поддерживайте открытую игру. Выбирайте свой свет.",
    "zh": "支持开放游戏，选择属于你的光。"
  },
  "Stylized aura preview": {
    "ru": "Стилизованная примерка ауры",
    "zh": "光环效果预览"
  },
  "PREVIEW": {
    "ru": "ПРИМЕРКА",
    "zh": "预览"
  },
  "Silver-armored hero with a sword and a glowing blue aura": {
    "ru": "Герой в серебряных доспехах с мечом и сияющей голубой аурой",
    "zh": "手持长剑、身穿银甲、环绕蓝色光环的英雄"
  },
  "Effect illustration. In the game, the aura follows your character.": {
    "ru": "Эскиз эффекта. В игре аура следует за вашим персонажем.",
    "zh": "效果示意图。在游戏中，光环会跟随你的角色。"
  },
  "Supporter active": {
    "ru": "Supporter активен",
    "zh": "支持者资格已生效"
  },
  "Free account": {
    "ru": "Бесплатный аккаунт",
    "zh": "免费账号"
  },
  "Your color": {
    "ru": "Ваш цвет",
    "zh": "你的颜色"
  },
  "Aura color": {
    "ru": "Цвет ауры",
    "zh": "光环颜色"
  },
  "Solar": {
    "ru": "Солнце",
    "zh": "日光"
  },
  "Lunar": {
    "ru": "Луна",
    "zh": "月光"
  },
  "Verdant": {
    "ru": "Лес",
    "zh": "森林"
  },
  "Aura and Supporter status on your phone and PC. Stats, rating and matchmaking stay equal for everyone.": {
    "ru": "Аура и статус сторонника на телефоне и ПК. Характеристики, рейтинг и подбор соперников одинаковы для всех.",
    "zh": "手机和电脑共享光环与支持者状态。所有玩家的属性、评分和匹配规则一致。"
  },
  "Aura selected. The game will receive the server update.": {
    "ru": "Аура выбрана. Игра получит обновление от сервера.",
    "zh": "光环已选择，游戏将从服务器接收更新。"
  },
  "Equip in game": {
    "ru": "Применить в игре",
    "zh": "在游戏中装备"
  },
  "Aura hidden. Your Supporter access remains active.": {
    "ru": "Аура выключена. Доступ Supporter сохраняется.",
    "zh": "光环已隐藏，支持者资格仍然有效。"
  },
  "Hide aura": {
    "ru": "Скрыть ауру",
    "zh": "隐藏光环"
  },
  "Access until": {
    "ru": "Доступ до",
    "zh": "资格有效至"
  },
  "Devices and account recovery": {
    "ru": "Устройства и восстановление аккаунта",
    "zh": "设备与账号恢复"
  },
  "Support development": {
    "ru": "Поддержать разработку",
    "zh": "支持开发"
  },
  "Use this account on all your devices to share one purchase. Save your recovery codes before paying.": {
    "ru": "Войдите на всех устройствах в этот аккаунт, чтобы использовать одну покупку. Перед оплатой сохраните резервные коды.",
    "zh": "在所有设备上使用同一账号即可共享购买。付款前请保存恢复码。"
  },
  "Loading payment options…": {
    "ru": "Загрузка вариантов оплаты…",
    "zh": "正在加载支付方式…"
  },
  "Website checkout is not available yet. You can preview the styles for free.": {
    "ru": "Оплата на сайте пока не подключена. Примерка доступна бесплатно.",
    "zh": "网站支付尚未开放，你可以免费预览外观。"
  },
  "days": {
    "ru": "дней",
    "zh": "天"
  },
  "Prepaid access, without automatic renewal. Your wallet shows network fees.": {
    "ru": "Предоплата без автоматического продления. Комиссию сети показывает кошелёк.",
    "zh": "预付资格，不自动续费。网络手续费以钱包显示为准。"
  },
  "Access already paid": {
    "ru": "Доступ уже оплачен",
    "zh": "资格已付费"
  },
  "Pay with Solana": {
    "ru": "Оплатить через Solana",
    "zh": "使用 Solana 支付"
  },
  "Already paid? Find your order": {
    "ru": "Уже оплатили? Найти свой счёт",
    "zh": "已付款？查找订单"
  },
  "Orders from the last 7 days. Select the order you paid and verify its transaction.": {
    "ru": "Здесь счета за последние 7 дней. Выберите тот, который оплачивали, и проверьте транзакцию.",
    "zh": "显示最近 7 天的订单。选择已付款订单并验证交易。"
  },
  "Check this order": {
    "ru": "Проверить этот счёт",
    "zh": "检查此订单"
  },
  "Payment for": {
    "ru": "Счёт для",
    "zh": "付款账号："
  },
  "Test network: switch your wallet to Solana Devnet before paying. Real funds are not required.": {
    "ru": "Тестовая сеть: перед оплатой переключите кошелёк на Solana Devnet. Настоящие средства не требуются.",
    "zh": "测试网络：付款前请将钱包切换至 Solana Devnet，无需真实资金。"
  },
  "The payment window expired. If you already paid, verify your transaction below; do not pay again.": {
    "ru": "Время оплаты истекло. Если уже оплатили, проверьте транзакцию ниже; не платите повторно.",
    "zh": "支付时限已过。如已付款，请在下方验证交易，不要重复付款。"
  },
  "Open wallet": {
    "ru": "Открыть кошелёк",
    "zh": "打开钱包"
  },
  "Payment confirmed. Choose and equip your aura.": {
    "ru": "Оплата подтверждена. Выберите и примените ауру.",
    "zh": "付款已确认，请选择并装备光环。"
  },
  "Transaction signature (optional)": {
    "ru": "Подпись транзакции (необязательно)",
    "zh": "交易签名（可选）"
  },
  "Verify payment": {
    "ru": "Проверить оплату",
    "zh": "验证付款"
  },
  "Do not send another payment while your first transaction is confirming.": {
    "ru": "Не отправляйте средства повторно, пока первая транзакция подтверждается.",
    "zh": "首笔交易确认期间，请勿再次付款。"
  },
  "On iPhone, purchase and restore are available inside the game through the App Store when enabled for the current build.": {
    "ru": "На iPhone покупка и восстановление покупок доступны внутри игры через App Store, когда они включены для текущей сборки.",
    "zh": "在 iPhone 上，当前版本开放购买后，可在游戏内通过 App Store 购买和恢复购买。"
  },
  "Your access": {
    "ru": "Ваш доступ",
    "zh": "你的资格"
  },
  "Expired": {
    "ru": "Завершён",
    "zh": "已到期"
  },
  "Check renewal in App Store": {
    "ru": "Продление: уточните в App Store",
    "zh": "请在 App Store 查看续费状态"
  },
  "Auto-renewal": {
    "ru": "Автопродление",
    "zh": "自动续费"
  },
  "No auto-renewal": {
    "ru": "Без автопродления",
    "zh": "不自动续费"
  },
  "Manage an App Store subscription in Apple ID settings. Cancelling renewal preserves the paid period; a refund may end access.": {
    "ru": "Подпиской App Store управляйте в настройках Apple ID. Отмена продления сохраняет уже оплаченный срок; возврат может прекратить доступ.",
    "zh": "请在 Apple ID 设置中管理 App Store 订阅。取消续费不影响已付费期限；退款可能终止资格。"
  },
  "Confirm sign-in through the game again. This action needs a login within the last 10 minutes.": {
    "ru": "Подтвердите вход через игру заново: для этого действия нужен вход за последние 10 минут.",
    "zh": "请通过游戏重新确认登录。此操作要求在最近 10 分钟内完成登录。"
  },
  "Generate recovery codes or connect another device first.": {
    "ru": "Сначала создайте резервные коды или подключите другое устройство.",
    "zh": "请先生成恢复码或连接其他设备。"
  },
  "Device limit reached. Revoke an unused device first.": {
    "ru": "Достигнут лимит устройств. Отключите неиспользуемое устройство.",
    "zh": "已达设备数量上限，请先撤销不再使用的设备。"
  },
  "Sign in again.": {
    "ru": "Войдите в аккаунт заново.",
    "zh": "请重新登录。"
  },
  "Too many requests. Please wait.": {
    "ru": "Слишком много запросов. Подождите немного.",
    "zh": "请求过于频繁，请稍候。"
  },
  "The service is temporarily unavailable. Please try later.": {
    "ru": "Сервис временно недоступен. Попробуйте позднее.",
    "zh": "服务暂时不可用，请稍后重试。"
  },
  "A matching finalized payment was not found yet. Check the network and amount, then retry in a minute. Do not pay again.": {
    "ru": "Подходящая подтверждённая оплата пока не найдена. Проверьте сеть, сумму и повторите проверку через минуту. Не платите повторно.",
    "zh": "尚未找到匹配且已确认的付款。请核对网络和金额，一分钟后重试，不要重复付款。"
  },
  "Access is already paid or your Apple subscription is still renewing. Check its status before paying again.": {
    "ru": "Доступ уже оплачен или подписка Apple ещё продлевается. Проверьте её статус перед новой оплатой.",
    "zh": "资格已付费，或 Apple 订阅仍在续费中。再次付款前请检查状态。"
  },
  "An active Supporter membership is required to equip an aura.": {
    "ru": "Для применения ауры нужен действующий Supporter.",
    "zh": "装备光环需要有效的支持者资格。"
  },
  "The state changed or this action was already completed. Refresh the page.": {
    "ru": "Состояние изменилось или действие уже выполнено. Обновите страницу.",
    "zh": "状态已变化或操作已完成，请刷新页面。"
  },
  "The action failed. Check the details and try again.": {
    "ru": "Не удалось выполнить действие. Проверьте данные и повторите.",
    "zh": "操作失败，请核对信息后重试。"
  },
  "Language": {
    "ru": "Язык",
    "zh": "语言"
  },
  "Creators": {
    "ru": "Авторам",
    "zh": "创作者"
  },
  "Workshop": {
    "ru": "Конструктор",
    "zh": "工坊"
  },
  "Devices": {
    "ru": "Устройства",
    "zh": "设备"
  },
  "Supporter": {
    "ru": "Поддержать",
    "zh": "支持者"
  },
  "Player portal": {
    "ru": "Кабинет игрока",
    "zh": "玩家中心"
  },
  "OMOBA player portal": {
    "ru": "Кабинет игрока OMOBA",
    "zh": "OMOBA 玩家中心"
  },
  "Main": {
    "ru": "Основная навигация",
    "zh": "主导航"
  },
  "Mobile": {
    "ru": "Мобильная навигация",
    "zh": "移动导航"
  },
  "OMOBA website": {
    "ru": "На сайт OMOBA",
    "zh": "OMOBA 官网"
  },
  "Website": {
    "ru": "На сайт",
    "zh": "官网"
  },
  "OPEN SOURCE · OPEN MOBA": {
    "ru": "ОТКРЫТЫЙ КОД · ОТКРЫТАЯ MOBA",
    "zh": "开源代码 · 开放 MOBA"
  },
  "OMOBA ACCOUNT": {
    "ru": "АККАУНТ OMOBA",
    "zh": "OMOBA 账号"
  },
  "OMOBA · PLAYER PORTAL": {
    "ru": "OMOBA · КАБИНЕТ ИГРОКА",
    "zh": "OMOBA · 玩家中心"
  },
  "OMOBA · GUEST PROTOTYPE": {
    "ru": "OMOBA · ГОСТЕВОЙ ПРОТОТИП",
    "zh": "OMOBA · 访客原型"
  },
  "Find your play.": {
    "ru": "Твоя игра. Твой набор.",
    "zh": "找到你的玩法。"
  },
  "Guest mode · browser drafts": {
    "ru": "Гостевой режим · черновики в браузере",
    "zh": "访客模式 · 浏览器草稿"
  },
  "This site provides the asset library, class builder, browser drafts and JSON downloads. Sign-in, match history, account saves and Ekza connection are currently disabled.": {
    "ru": "На этом сайте доступны каталог, конструктор, черновики в браузере и выгрузка JSON. Вход, история матчей, сохранение в аккаунт и подключение Ekza пока отключены.",
    "zh": "本站提供素材库、职业构建器、浏览器草稿和 JSON 下载。登录、比赛记录、账号保存和 Ekza 连接目前尚未启用。"
  },
  "Open class workshop": {
    "ru": "Открыть конструктор",
    "zh": "打开职业工坊"
  },
  "Asset library": {
    "ru": "Каталог ассетов",
    "zh": "素材库"
  },
  "OMOBA spellblade illustration": {
    "ru": "Иллюстрация OMOBA: воин с серебряным мечом",
    "zh": "OMOBA 持剑战士插画"
  },
  "OMOBA concept art · not an in-game skin": {
    "ru": "Концепт-арт OMOBA · не игровой скин",
    "zh": "OMOBA 概念图 · 非游戏皮肤"
  },
  "Guest prototype": {
    "ru": "Гостевой прототип",
    "zh": "访客原型"
  },
  "Development environment: test data, not the live OMOBA site": {
    "ru": "Тестовая среда: тестовые данные, не рабочий сайт OMOBA",
    "zh": "开发环境：测试数据，并非正式 OMOBA 网站"
  },
  "MATCH REPORT": {
    "ru": "ОТЧЁТ О МАТЧЕ",
    "zh": "比赛报告"
  },
  "YOUR PROGRESS": {
    "ru": "ТВОЙ ПРОГРЕСС",
    "zh": "你的进度"
  },
  "Showing the latest 1000 rating changes.": {
    "ru": "Показаны последние 1000 изменений рейтинга.",
    "zh": "显示最近 1000 次评分变化。"
  },
  "Default": {
    "ru": "Стандартный",
    "zh": "默认"
  },
  "OPEN MOBA SUPPORTER": {
    "ru": "ПОДДЕРЖКА OPEN MOBA",
    "zh": "支持开放 MOBA"
  },
  "Warrior": {
    "ru": "Воин",
    "zh": "战士"
  },
  "Ranger": {
    "ru": "Рейнджер",
    "zh": "游侠"
  },
  "Mage": {
    "ru": "Маг",
    "zh": "法师"
  },
  "Cleric": {
    "ru": "Жрец",
    "zh": "牧师"
  },
  "Nickname#1234": {
    "ru": "Никнейм#1234",
    "zh": "昵称#1234"
  }
};
export const portalTranslations: Record<string, { ru: string; zh: string }> = Object.fromEntries(
  (Object.keys(en) as Array<keyof Words>).map(key => [en[key], { ru: ru[key], zh: zh[key] }]),
);
Object.assign(portalTranslations, supplementalTranslations);
