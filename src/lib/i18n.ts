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
  "Hero": {"ru": "Hero", "zh": "英雄"},
  "Hero active": {"ru": "Hero активен", "zh": "英雄资格已生效"},
  "Months supported": {"ru": "Месяцев поддержки", "zh": "支持月数"},
  "Hero until": {"ru": "Hero до", "zh": "英雄资格有效期至"},
  "POWERED BY PLAYERS": {"ru": "БЛАГОДАРЯ ИГРОКАМ", "zh": "由玩家支持"},
  "Supporters": {"ru": "Поддержавшие проект", "zh": "支持者"},
  "Thank you for keeping an open game growing.": {"ru": "Спасибо, что помогаете открытой игре расти.", "zh": "感谢你帮助开放游戏不断成长。"},
  "Every paid month counts. Recognition stays after Hero expires.": {"ru": "Каждый оплаченный месяц учитывается. Благодарность остаётся и после окончания Hero.", "zh": "每个已付费月份都会被记录。英雄资格到期后，支持记录仍会保留。"},
  "Support the game": {"ru": "Поддержать игру", "zh": "支持游戏"},
  "Our community": {"ru": "Наше сообщество", "zh": "我们的社区"},
  "Only players who choose public recognition appear here. Profile statistics follow each player’s privacy settings.": {"ru": "Здесь только игроки, выбравшие публичную благодарность. Доступ к статистике зависит от настроек каждого игрока.", "zh": "这里只展示选择公开支持记录的玩家。个人统计遵循每位玩家的隐私设置。"},
  "The supporter directory is unavailable in this guest prototype. Accounts and payments are not enabled here.": {"ru": "Список поддержавших недоступен в этом гостевом прототипе. Аккаунты и оплата здесь ещё не включены.", "zh": "此访客原型暂不提供支持者名单。账号和支付功能尚未启用。"},
  "The supporter directory could not be loaded. Please try again.": {"ru": "Не удалось загрузить список поддержавших. Попробуйте ещё раз.", "zh": "无法加载支持者名单，请重试。"},
  "Loading supporters…": {"ru": "Загружаем список поддержавших…", "zh": "正在加载支持者…"},
  "No supporters on this page. Return to the previous page.": {"ru": "На этой странице пока никого нет. Вернитесь на предыдущую.", "zh": "此页暂无支持者，请返回上一页。"},
  "No public supporters yet. Recognition is always optional.": {"ru": "Публичных записей пока нет. Благодарность по имени всегда добровольна.", "zh": "暂无公开支持者。公开支持记录始终由玩家自愿选择。"},
  "View game profile": {"ru": "Открыть игровой профиль", "zh": "查看游戏资料"},
  "Supporter pages": {"ru": "Страницы поддержавших", "zh": "支持者分页"},
  "MONTHLY SUPPORT · HERO": {"ru": "ЕЖЕМЕСЯЧНАЯ ПОДДЕРЖКА · HERO", "zh": "每月支持 · 英雄"},
  "Support OMOBA voluntarily. Each paid month brings a cosmetic Hero aura.": {"ru": "Поддерживайте OMOBA добровольно. Каждый оплаченный месяц даёт косметическую ауру Hero.", "zh": "自愿支持 OMOBA，每个付费月份均可获得英雄外观光环。"},
  "Hero preview": {"ru": "Примерка Hero", "zh": "英雄效果预览"},
  "Hero follows your account on phone and PC. It changes your appearance only: stats, rating and matchmaking stay equal for everyone.": {"ru": "Hero доступен на телефоне и ПК с одним аккаунтом. Меняется только внешний вид: характеристики, рейтинг и подбор игроков равны для всех.", "zh": "英雄资格随账号在手机与电脑间共享，仅改变外观：属性、评分和匹配规则对所有玩家相同。"},
  "Aura hidden. Your Hero access remains active.": {"ru": "Аура скрыта. Доступ Hero остаётся активным.", "zh": "光环已隐藏，英雄资格仍然有效。"},
  "Public recognition": {"ru": "Публичная благодарность", "zh": "公开支持记录"},
  "One month is one verified paid period. Expired months remain counted; refunded periods do not.": {"ru": "Один месяц — один подтверждённый оплаченный период. Истёкшие периоды учитываются, возвращённые платежи — нет.", "zh": "一个月代表一个已验证的付费周期。已到期周期仍计入总数，已退款周期不计入。"},
  "Show my name and supported months in the public directory": {"ru": "Показывать мой ник и месяцы поддержки в публичном списке", "zh": "在公开名单中显示我的昵称和支持月数"},
  "Recognition preference saved.": {"ru": "Настройка публичной благодарности сохранена.", "zh": "公开支持记录设置已保存。"},
  "This is optional. Your profile must also be public; statistics keep their own privacy setting.": {"ru": "Это добровольно. Профиль также должен быть публичным; доступ к статистике настраивается отдельно.", "zh": "此选项完全自愿。个人资料也需设为公开；统计数据仍使用独立的隐私设置。"},
  "Your profile is private, so you are not listed. You can review profile visibility in Settings.": {"ru": "Ваш профиль закрыт, поэтому вас нет в списке. Публичность профиля можно изменить в настройках.", "zh": "你的个人资料未公开，因此不会出现在名单中。可在设置中调整资料可见性。"},
  "You will appear after your first verified paid month.": {"ru": "Вы появитесь в списке после первого подтверждённого оплаченного месяца.", "zh": "首次付费月份验证通过后，你将出现在名单中。"},
  "Meet the supporters": {"ru": "Кто поддержал проект", "zh": "查看支持者"},
  "Solana supports one 30-day period at a time. You choose whether to support again after it ends.": {"ru": "Через Solana оплачивается один период в 30 дней. После его окончания вы сами решаете, поддержать ли игру снова.", "zh": "Solana 每次支持一个 30 天周期，到期后由你决定是否再次支持。"},
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
  },
  // Markets (docs/markets.md): VK ID sign-in, registration and /connect.
  "Sign in": {"ru": "Войти", "zh": "登录"},
  "Sign in to OMOBA": {"ru": "Вход в OMOBA", "zh": "登录 OMOBA"},
  "Use your VK, OK or Mail.ru account. New players get a profile here. If you already play, link your existing profile from the game first.": {"ru": "Войдите через VK, OK или Mail.ru. Новый профиль можно создать здесь. Если вы уже играете, сначала привяжите свой профиль в игре, чтобы сохранить прогресс.", "zh": "使用 VK、OK 或 Mail.ru 登录。新玩家可在这里创建资料。如果你已经玩过，请先在游戏中关联现有资料以保留进度。"},
  "After signing in, install OMOBA and open Profile → “Sign in with VK ID” in the game to use this account.": {"ru": "После входа установите OMOBA и откройте в игре «Профиль → Войти через VK ID», чтобы играть с этим аккаунтом.", "zh": "登录后安装 OMOBA，并在游戏中打开“个人资料 → 使用 VK ID 登录”，即可使用此账号。"},
  "Install OMOBA, select Russia, then open Profile → “Sign in with VK ID”. Use the same VK, OK or Mail.ru account you used here.": {"ru": "Установите OMOBA, выберите регион «Россия», затем откройте «Профиль → Войти через VK ID». Используйте тот же аккаунт VK, OK или Mail.ru, с которым вошли здесь.", "zh": "安装 OMOBA，选择“俄罗斯”地区，然后打开“个人资料 → 使用 VK ID 登录”。请使用在这里登录时使用的同一个 VK、OK 或 Mail.ru 账号。"},
  "Use your VK, OK or Mail.ru account. The game confirms the first link to your profile.": {"ru": "Войдите через аккаунт VK, OK или Mail.ru. Первую привязку к игровому профилю подтверждает игра.", "zh": "使用 VK、OK 或 Mail.ru 账号登录。首次与游戏资料关联需在游戏中确认。"},
  "Or connect your game": {"ru": "Или подключите игру", "zh": "或连接游戏账号"},
  "Sign in with VK ID": {"ru": "Войти через VK ID", "zh": "使用 VK ID 登录"},
  "Odnoklassniki": {"ru": "Одноклассники", "zh": "Odnoklassniki（OK）"},
  "VK ID sign-in did not complete. Try again.": {"ru": "Вход через VK ID не завершён. Попробуйте ещё раз.", "zh": "VK ID 登录未完成，请重试。"},
  "Sign-in was cancelled.": {"ru": "Вход отменён.", "zh": "已取消登录。"},
  "VK ID did not confirm this sign-in. Try again or choose another account.": {"ru": "VK ID не подтвердил вход. Попробуйте ещё раз или выберите другой аккаунт.", "zh": "VK ID 未确认此次登录，请重试或选择其他账号。"},
  "VK ID is not responding right now. Try again in a few minutes.": {"ru": "VK ID сейчас не отвечает. Попробуйте через несколько минут.", "zh": "VK ID 暂时无响应，请几分钟后重试。"},
  "Sign-in with VK ID is unavailable right now. Try again later.": {"ru": "Вход через VK ID сейчас недоступен. Попробуйте позже.", "zh": "VK ID 登录暂不可用，请稍后重试。"},
  "Too many active browser sessions. Sign out on another browser and try again.": {"ru": "Слишком много активных веб-сессий. Выйдите в другом браузере и попробуйте снова.", "zh": "活跃的浏览器会话过多。请在其他浏览器退出后重试。"},
  "Too many sign-in attempts. Please wait a minute.": {"ru": "Слишком много попыток входа. Подождите минуту.", "zh": "登录尝试过多，请稍候一分钟。"},
  "VK ID · NEW PLAYER": {"ru": "VK ID · НОВЫЙ ИГРОК", "zh": "VK ID · 新玩家"},
  "Almost there": {"ru": "Почти готово", "zh": "即将完成"},
  "VK account “{name}” confirmed.": {"ru": "Аккаунт VK «{name}» подтверждён.", "zh": "VK 账号“{name}”已确认。"},
  "Install OMOBA, open Profile → “Sign in with VK ID” — your game profile will be linked to this VK account.": {"ru": "Установите OMOBA, откройте «Профиль → Войти через VK ID» — ваш игровой профиль будет связан с этим аккаунтом VK.", "zh": "安装 OMOBA，打开“个人资料 → 使用 VK ID 登录”，你的游戏资料将与此 VK 账号关联。"},
  "The confirmation is valid until": {"ru": "Подтверждение действует до", "zh": "确认有效期至"},
  "Use another account": {"ru": "Войти другим аккаунтом", "zh": "使用其他账号"},
  "CONNECT A DEVICE": {"ru": "ВХОД НА УСТРОЙСТВЕ", "zh": "设备登录"},
  "Sign in on your device": {"ru": "Вход в игру на устройстве", "zh": "在设备上登录"},
  "Connect your game instead": {"ru": "Подключить через игру", "zh": "改为连接游戏账号"},
  "This link has no valid device code. Open it again from the game.": {"ru": "В ссылке нет корректного кода устройства. Откройте её из игры ещё раз.", "zh": "此链接没有有效的设备代码，请从游戏中重新打开。"},
  "Done. Return to the game and confirm sign-in.": {"ru": "Готово. Вернитесь в игру и подтвердите вход.", "zh": "完成。请返回游戏并确认登录。"},
  "Return to the game and confirm.": {"ru": "Вернитесь в игру и подтвердите.", "zh": "请返回游戏并确认。"},
  "Return to OMOBA on this device": {"ru": "Вернуться в OMOBA на этом устройстве", "zh": "返回此设备上的 OMOBA"},
  "Loading VK ID…": {"ru": "Загружаем VK ID…", "zh": "正在加载 VK ID…"},
  "Completing sign-in…": {"ru": "Завершаем вход…", "zh": "正在完成登录…"},
  "Other sign-in methods": {"ru": "Другие способы входа", "zh": "其他登录方式"},
  "Quick sign-in did not complete. Choose a service or try again.": {"ru": "Не удалось завершить быстрый вход. Выберите сервис или попробуйте ещё раз.", "zh": "未能完成快捷登录。请选择服务或重试。"},
  "The code or the VK confirmation expired. Start again in the game.": {"ru": "Код или подтверждение VK истекли. Начните заново в игре.", "zh": "代码或 VK 确认已过期，请在游戏中重新开始。"},
  "The code expired. Start again in the game.": {"ru": "Код истёк. Начните заново в игре.", "zh": "代码已过期，请在游戏中重新开始。"},
  "This code is already linked. Return to the game and confirm.": {"ru": "Этот код уже привязан. Вернитесь в игру и подтвердите.", "zh": "此代码已关联。请返回游戏并确认。"},
  "For your security, sign in with VK again to confirm this device.": {"ru": "Для безопасности войдите через VK ещё раз, чтобы подтвердить устройство.", "zh": "为了安全，请再次通过 VK 登录以确认此设备。"},
  "Checking the code…": {"ru": "Проверяем код…", "zh": "正在检查代码…"},
  "The signed-in account changed. Review the account and device again before confirming.": {"ru": "Аккаунт входа изменился. Ещё раз проверьте аккаунт и устройство перед подтверждением.", "zh": "当前登录账号已更改。确认前请再次核对账号和设备。"},
  "Sign in as {nickname} on the device “{label}”?": {"ru": "Войти как {nickname} на устройстве «{label}»?", "zh": "以 {nickname} 身份登录设备“{label}”？"},
  "Key fingerprint": {"ru": "Отпечаток ключа", "zh": "密钥指纹"},
  "Link VK “{name}” from the game on device “{label}”?": {"ru": "Привязать VK «{name}» из игры на устройстве «{label}»?", "zh": "从设备“{label}”上的游戏关联 VK“{name}”？"},
  "Your current game profile and progress will be kept. Continue here, then confirm the link in the game.": {"ru": "Ваш текущий игровой профиль и прогресс сохранятся. Продолжите здесь, затем подтвердите привязку в игре.", "zh": "你当前的游戏资料和进度将保留。请在此继续，然后在游戏中确认关联。"},
  "Compare it with the fingerprint shown in the game.": {"ru": "Сравните его с отпечатком в игре.", "zh": "请与游戏中显示的指纹核对。"},
  "Confirm sign-in": {"ru": "Подтвердить вход", "zh": "确认登录"},
  "VK “{name}” is not linked to an OMOBA profile yet. Press “Continue” and confirm the link in the game.": {"ru": "VK «{name}» ещё не связан с профилем OMOBA. Нажмите «Продолжить» и подтвердите привязку в игре.", "zh": "VK“{name}”尚未关联 OMOBA 资料。请点击“继续”，然后在游戏中确认关联。"},
  "Continue": {"ru": "Продолжить", "zh": "继续"},
  // LR-18: progress follows the VK-linked account (ProgressFollowsVk).
  "Progress follows the VK-linked account. After a reinstall or on a new device, open Profile → “Sign in with VK ID” in the game and sign in with the same VK ID to get your profile back. Recovery codes work on any device too.": {"ru": "Прогресс следует за аккаунтом, привязанным к VK. После переустановки игры или на новом устройстве откройте в игре «Профиль → Войти через VK ID» и войдите с тем же VK ID — профиль вернётся. Коды восстановления тоже работают на любом устройстве.", "zh": "进度跟随已关联 VK 的账号。重新安装游戏或换用新设备后，在游戏中打开“个人资料 → 使用 VK ID 登录”，并用同一个 VK ID 登录即可找回资料。恢复码在任何设备上同样有效。"},
  "Sign in to confirm this device.": {"ru": "Войдите, чтобы подтвердить это устройство.", "zh": "请登录以确认此设备。"},
  "Unlink this VK account? You can still sign in through the game.": {"ru": "Отвязать этот аккаунт VK? Войти можно будет через игру.", "zh": "确定解除此 VK 账号关联？你仍可通过游戏登录。"},
  "Sign in again to confirm this action: it needs a sign-in within the last 10 minutes.": {"ru": "Войдите заново, чтобы подтвердить действие: нужен вход не позднее 10 минут назад.", "zh": "请重新登录以确认此操作：需要最近 10 分钟内的登录。"},
  "VK account unlinked.": {"ru": "Аккаунт VK отвязан.", "zh": "VK 账号已解除关联。"},
  "Linked: {method} · {date}": {"ru": "Привязан: {method} · {date}", "zh": "已关联：{method} · {date}"},
  "Unlink VK": {"ru": "Отвязать VK", "zh": "解除 VK 关联"},
  "Connect a game device or create recovery codes before unlinking your only sign-in method.": {"ru": "Подключите игровое устройство или создайте резервные коды, прежде чем отвязать единственный способ входа.", "zh": "请先连接游戏设备或生成恢复代码，再解除唯一登录方式的关联。"},
  "No VK account is linked. Link one in the game: Profile → “Sign in with VK”.": {"ru": "Аккаунт VK не привязан. Привяжите его в игре: «Профиль → Войти через VK».", "zh": "尚未关联 VK 账号。可在游戏中关联：“个人资料 → 通过 VK 登录”。"},
  "This site provides the class builder, browser drafts and JSON downloads. Sign-in, match history and account saves are currently disabled.": {"ru": "Здесь доступны редактор классов, черновики в браузере и выгрузка JSON. Вход, история матчей и сохранения в аккаунте сейчас отключены.", "zh": "本网站提供职业编辑器、浏览器草稿和 JSON 下载。登录、比赛记录和账号保存功能目前已停用。"}
};
export const portalTranslations: Record<string, { ru: string; zh: string }> = Object.fromEntries(
  (Object.keys(en) as Array<keyof Words>).map(key => [en[key], { ru: ru[key], zh: zh[key] }]),
);
Object.assign(portalTranslations, supplementalTranslations);
