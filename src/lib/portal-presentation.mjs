/** Presentation only: settled server results remain the source of truth. */
export function resultTone(won, state) {
  if (state !== 'completed') return 'neutral';
  return won === true ? 'won' : won === false ? 'lost' : 'neutral';
}

export function playerResult(match, profileId) {
  const player = match.participants.find(participant => participant.profile_id === profileId);
  if (!player || !match.winner || match.outcome !== 'completed' || !match.participants.some(participant => participant.team === match.winner)) return null;
  return player.team === match.winner;
}

export function teamSummaries(match) {
  const teams = new Map();
  for (const participant of match.participants) {
    const team = teams.get(participant.team) || { id: participant.team, participants: [], kills: 0, deaths: 0, assists: 0, damage: 0, structures: 0, result: 'neutral' };
    team.participants.push(participant);
    team.kills += participant.stats.kills;
    team.deaths += participant.stats.deaths;
    team.assists += participant.stats.assists;
    team.damage += participant.stats.damage_to_heroes;
    team.structures += participant.stats.structures_destroyed;
    teams.set(participant.team, team);
  }
  const decided = match.outcome === 'completed' && teams.has(match.winner);
  return [...teams.values()].map(team => ({ ...team, result: decided ? (team.id === match.winner ? 'won' : 'lost') : 'neutral' }));
}

export function recordRate(wins, losses) {
  if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins < 0 || losses < 0 || wins + losses === 0) return null;
  return wins / (wins + losses);
}

/** Percentages are bounded for the meter; an absent value stays absent. */
export function meterPercent(ratio) {
  return Number.isFinite(ratio) ? Math.max(0, Math.min(100, ratio * 100)) : null;
}

export function ratingBounds(points) {
  if (!points.length) return null;
  const values = points.flatMap(point => [point.before, point.after]).filter(Number.isFinite);
  if (!values.length) return null;
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max(20, Math.ceil((high - low) * 0.15));
  return { min: Math.floor((low - padding) / 10) * 10, max: Math.ceil((high + padding) / 10) * 10 };
}

const CLASS_ART = Object.freeze({ warrior: 'warrior', ranger: 'ranger', mage: 'mage', cleric: 'cleric' });
export function classArtwork(name) {
  const key = String(name).toLowerCase();
  return Object.hasOwn(CLASS_ART, key) ? '/art/portal/classes/' + CLASS_ART[key] + '.png' : null;
}
export function classDisplayName(name) {
  const key = String(name).toLowerCase();
  return Object.hasOwn(CLASS_ART, key) ? key[0].toUpperCase() + key.slice(1) : String(name);
}
export function teamDisplayName(name, locale) {
  const names = { green: { en: 'Green', ru: 'зелёных', zh: '绿色' }, blue: { en: 'Blue', ru: 'синих', zh: '蓝色' } };
  return Object.hasOwn(names, name) ? names[name][locale] || names[name].en : name;
}

const COPY = {
  en: {
    career: 'PLAYER CAREER', careerIntro: 'Every match leaves a mark. Make the next one count.',
    play: 'Play in browser', practice: 'Local practice', record: 'Wins / losses', matches: 'Matches played',
    historyIntro: 'Your results, from the first move to the final score.', statsIntro: 'See what is working. Find your next advantage.',
    report: 'MATCH REPORT', score: 'Team kills', winner: 'Winning team', loser: 'Losing team', undecided: 'No winner',
    you: 'You', performance: 'Performance', details: 'Player details', rating: 'Rating change',
    damage: 'Hero damage', teamDamage: 'Team damage', structures: 'Structures destroyed', kills: 'Kills',
    account: 'Your player identity', accountHint: 'Share your tag to find your team.',
    signIn: 'ONE ACCOUNT. EVERY MATCH.', signInIntro: 'Your history, your progress, your team.',
    ratingEmpty: 'Your rating journey starts with your first rated match.',
    classesEmpty: 'Class statistics appear after your first recorded match.',
    credits: 'Icon credits', viewMatch: 'View match', current: 'Latest rating', start: 'Starting rating',
    noResult: 'This match has no recorded winner.', allResults: 'All results',
  },
  ru: {
    career: 'КАРЬЕРА ИГРОКА', careerIntro: 'Каждый матч оставляет след. Следующий может стать лучшим.',
    play: 'Играть в браузере', practice: 'Локальная тренировка', record: 'Победы / поражения', matches: 'Сыграно матчей',
    historyIntro: 'Твои результаты от первого хода до финального счёта.', statsIntro: 'Узнай свои сильные стороны. Найди следующее преимущество.',
    report: 'ОТЧЁТ О МАТЧЕ', score: 'Убийства команд', winner: 'Команда победителей', loser: 'Проигравшая команда', undecided: 'Без победителя',
    you: 'Ты', performance: 'Результативность', details: 'Подробности игрока', rating: 'Изменение рейтинга',
    damage: 'Урон героям', teamDamage: 'Урон команды', structures: 'Уничтожено строений', kills: 'Убийства',
    account: 'Твой игровой профиль', accountHint: 'Поделись тегом, чтобы найти свою команду.',
    signIn: 'ОДИН АККАУНТ. КАЖДЫЙ МАТЧ.', signInIntro: 'Твоя история, твой прогресс, твоя команда.',
    ratingEmpty: 'История рейтинга начнётся с первого рейтингового матча.',
    classesEmpty: 'Статистика классов появится после первого сохранённого матча.',
    credits: 'Авторы иконок', viewMatch: 'Открыть матч', current: 'Последний рейтинг', start: 'Начальный рейтинг',
    noResult: 'У этого матча нет сохранённого победителя.', allResults: 'Все результаты',
  },
  zh: {
    career: '玩家生涯', careerIntro: '每场比赛都留下印记，让下一场更精彩。',
    play: '在浏览器中游玩', practice: '本地练习', record: '胜 / 负', matches: '已玩场次',
    historyIntro: '从第一步到最终比分，查看你的每场战绩。', statsIntro: '了解你的强项，找到下一个优势。',
    report: '比赛报告', score: '团队击杀', winner: '获胜队伍', loser: '失利队伍', undecided: '无胜方',
    you: '你', performance: '表现', details: '玩家详情', rating: '评分变化',
    damage: '英雄伤害', teamDamage: '团队伤害', structures: '摧毁建筑', kills: '击杀',
    account: '你的玩家身份', accountHint: '分享标签，找到你的队友。',
    signIn: '一个账号，每场比赛。', signInIntro: '你的战绩、成长和队伍。',
    ratingEmpty: '完成第一场排位赛后即可查看评分记录。', classesEmpty: '第一场已记录的比赛后将显示职业统计。',
    credits: '图标署名', viewMatch: '查看比赛', current: '最新评分', start: '起始评分',
    noResult: '本场比赛没有已记录的胜方。', allResults: '全部结果',
  },
};
export function presentationWords(locale) { return COPY[locale] || COPY.en; }
