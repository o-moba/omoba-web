/** Selected season progress; absence retains the pre-season API contract. */
const validCount = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const validRating = value => Number.isInteger(value) && value >= 0 && value <= 5000;
export function ratingTier(rating) {
  if (!validRating(rating)) return null;
  return rating < 1000 ? 'bronze' : rating < 1500 ? 'silver' : rating < 2000 ? 'gold'
    : rating < 2500 ? 'platinum' : rating < 3000 ? 'diamond' : 'master';
}
export function rankedProgress(profile, placements = 20) {
  if (!profile || !validRating(profile.rating) || !validCount(placements) || placements === 0) return null;
  const season = profile.ranked;
  if (season != null && (typeof season !== 'object' || !validCount(season.rated_matches)
      || !Number.isSafeInteger(season.season_id) || season.season_id <= 0
      || !Number.isSafeInteger(season.started_at_ms) || season.started_at_ms < 0
      || !Number.isSafeInteger(season.ends_at_ms) || season.ends_at_ms - season.started_at_ms !== 7776000000)) return null;
  const count = season?.rated_matches ?? profile.rated_matches;
  if (!validCount(count)) return null;
  return { seasonId: season?.season_id ?? null, endsAt: season?.ends_at_ms ?? null,
    played: count, total: placements, calibrated: count >= placements,
    tier: count >= placements ? ratingTier(profile.rating) : null };
}
export function earnedSeasonBadge(profile) {
  if (!rankedProgress(profile)) return null;
  const badge = profile.ranked?.latest_badge;
  if (!badge || !Number.isSafeInteger(badge.season_id) || badge.season_id <= 0
      || !Number.isSafeInteger(badge.ended_at_ms) || badge.ended_at_ms < 0
      || !validRating(badge.rating) || !validCount(badge.rated_matches)) return null;
  const tier = badge.rated_matches >= 20 ? ratingTier(badge.rating) : null;
  if (badge.tier != null && badge.tier !== tier) return null;
  return { seasonId: badge.season_id, endedAt: badge.ended_at_ms, rating: badge.rating,
    played: badge.rated_matches, tier };
}
const COPY = {
  ru: { bronze:'Бронза',silver:'Серебро',gold:'Золото',platinum:'Платина',diamond:'Алмаз',master:'Мастер',
    ladderIntro:'Лучшие игроки сезона. В таблицу попадают прошедшие калибровку: {total} Ranked-матчей в текущем сезоне.',placement:'Калибровка {n}/{total}',season:'Сезон {n}',until:'До {date}',badge:'Значок сезона {n}',participation:'Участник сезона',
    help:'Первые 20 Ranked-матчей каждого сезона — калибровка. Опыт и доступ к Ranked сохраняются.',archive:'Прошлые сезоны',emptyArchive:'Завершённых сезонов пока нет.',finalRating:'Итоговый рейтинг',seasonMatches:'Матчи сезона',record:'Победы / поражения',noBadge:'Без сезонного значка' },
  en: { bronze:'Bronze',silver:'Silver',gold:'Gold',platinum:'Platinum',diamond:'Diamond',master:'Master',
    ladderIntro:'This season’s top players. Complete {total} Ranked games in the current season to finish placements and join the ladder.',placement:'Placement {n}/{total}',season:'Season {n}',until:'Until {date}',badge:'Season {n} badge',participation:'Season participant',
    help:'The first 20 Ranked games each season are placements. Experience and Ranked access are preserved.',archive:'Past seasons',emptyArchive:'No completed seasons yet.',finalRating:'Final rating',seasonMatches:'Season games',record:'Wins / losses',noBadge:'No seasonal badge' },
  zh: { bronze:'青铜',silver:'白银',gold:'黄金',platinum:'铂金',diamond:'钻石',master:'大师',
    ladderIntro:'本赛季排行榜。完成本赛季{total}场排位赛，结束定位赛后即可上榜。',placement:'定位赛 {n}/{total}',season:'第 {n} 赛季',until:'截至 {date}',badge:'第 {n} 赛季徽章',participation:'赛季参与者',
    help:'每个赛季的前20场排位赛为定位赛。经验和排位资格将保留。',archive:'历史赛季',emptyArchive:'暂无已结束的赛季。',finalRating:'最终分数',seasonMatches:'赛季对局',record:'胜 / 负',noBadge:'无赛季徽章' },
};
export function rankedWords(locale) { return COPY[locale] || COPY.en; }
