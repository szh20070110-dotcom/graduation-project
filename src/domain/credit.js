export const CREDIT_RULES = Object.freeze({
  initialScore: 100,
  minScore: 0,
  maxScore: 100,
  noShowDelta: -10,
  checkInDelta: 2,
  banScore: 60,
  banNoShowCount: 3,
  banDays: 7
})

export function clampScore(score, rules = CREDIT_RULES) {
  if (!Number.isFinite(score)) return rules.initialScore
  return Math.min(rules.maxScore, Math.max(rules.minScore, score))
}

export function getCreditLevel(score) {
  if (score >= 90) return { label: '优秀', tone: 'success', advice: '信用良好，可正常预约' }
  if (score >= 75) return { label: '良好', tone: 'info', advice: '请按时签到，保持信用' }
  if (score >= 60) return { label: '预警', tone: 'warning', advice: '信用偏低，再爽约将被限制预约' }
  return { label: '受限', tone: 'danger', advice: '信用分低于 60，预约受限' }
}

export function applyNoShow(user, now = new Date(), rules = CREDIT_RULES) {
  const baseScore = Number.isFinite(user.creditScore) ? user.creditScore : rules.initialScore
  const score = clampScore(baseScore + rules.noShowDelta, rules)
  const noShowCount = (user.noShowCount || 0) + 1
  const shouldBan = score < rules.banScore || noShowCount >= rules.banNoShowCount
  const existingBan = user.bannedUntil ? new Date(user.bannedUntil) : null
  const shouldExtend = shouldBan && (!existingBan || existingBan <= now)
  const bannedUntil = shouldExtend
    ? new Date(now.getTime() + rules.banDays * 24 * 60 * 60 * 1000).toISOString()
    : user.bannedUntil || null
  return {
    creditScore: score,
    noShowCount,
    bannedUntil,
    banReason: bannedUntil ? `爽约 ${noShowCount} 次，信用分 ${score}` : null,
    updatedAt: now.toISOString()
  }
}

export function applyCheckIn(user, rules = CREDIT_RULES) {
  const baseScore = Number.isFinite(user.creditScore) ? user.creditScore : rules.initialScore
  return {
    creditScore: clampScore(baseScore + rules.checkInDelta, rules),
    updatedAt: new Date().toISOString()
  }
}

export function isBanned(user, now = new Date()) {
  if (!user || !user.bannedUntil) return false
  const until = new Date(user.bannedUntil)
  if (Number.isNaN(until.getTime())) return false
  return until.getTime() > now.getTime()
}

export function banRemainingDays(user, now = new Date()) {
  if (!isBanned(user, now)) return 0
  const diff = new Date(user.bannedUntil).getTime() - now.getTime()
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

export function liftBan(user) {
  return {
    ...user,
    bannedUntil: null,
    banReason: null
  }
}

export function canReserve(user, now = new Date()) {
  return !isBanned(user, now)
}