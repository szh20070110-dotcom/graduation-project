import { describe, expect, it } from 'vitest'
import {
  CREDIT_RULES,
  applyCheckIn,
  applyNoShow,
  banRemainingDays,
  canReserve,
  clampScore,
  getCreditLevel,
  isBanned,
  liftBan
} from '../../src/domain/credit.js'

const NOW = new Date('2026-11-03T12:00:00.000Z')

function student(overrides = {}) {
  return {
    id: 'user-1',
    creditScore: CREDIT_RULES.initialScore,
    noShowCount: 0,
    bannedUntil: null,
    banReason: null,
    ...overrides
  }
}

describe('信用分基础规则', () => {
  it('clampScore 限制在 0-100 之间，非法值回落到初始分', () => {
    expect(clampScore(120)).toBe(100)
    expect(clampScore(-5)).toBe(0)
    expect(clampScore(72.5)).toBe(72.5)
    expect(clampScore(Number.NaN)).toBe(CREDIT_RULES.initialScore)
    expect(clampScore(undefined)).toBe(CREDIT_RULES.initialScore)
  })

  it('信用等级覆盖优秀/良好/预警/受限四档边界', () => {
    expect(getCreditLevel(100).label).toBe('优秀')
    expect(getCreditLevel(90).label).toBe('优秀')
    expect(getCreditLevel(89).label).toBe('良好')
    expect(getCreditLevel(75).label).toBe('良好')
    expect(getCreditLevel(74).label).toBe('预警')
    expect(getCreditLevel(60).label).toBe('预警')
    expect(getCreditLevel(59).label).toBe('受限')
    expect(getCreditLevel(0).tone).toBe('danger')
  })
})

describe('爽约计分', () => {
  it('每次爽约扣 10 分并累加爽约次数', () => {
    const result = applyNoShow(student({ creditScore: 100 }), NOW)
    expect(result.creditScore).toBe(90)
    expect(result.noShowCount).toBe(1)
    expect(result.bannedUntil).toBeNull()
    expect(result.banReason).toBeNull()
    expect(result.updatedAt).toBe(NOW.toISOString())
  })

  it('信用分不低于 0，连续爽约触发下限保护', () => {
    const result = applyNoShow(student({ creditScore: 5 }), NOW)
    expect(result.creditScore).toBe(0)
  })

  it('累计爽约 3 次触发 7 天禁约', () => {
    const result = applyNoShow(student({ creditScore: 90, noShowCount: 2 }), NOW)
    expect(result.creditScore).toBe(80)
    expect(result.noShowCount).toBe(3)
    expect(result.bannedUntil).toBe('2026-11-10T12:00:00.000Z')
    expect(result.banReason).toContain('爽约 3 次')
    expect(isBanned({ bannedUntil: result.bannedUntil }, NOW)).toBe(true)
    expect(banRemainingDays({ bannedUntil: result.bannedUntil }, NOW)).toBe(7)
  })

  it('信用分跌破 60 时即使爽约次数不足也触发禁约', () => {
    const first = applyNoShow(student({ creditScore: 65 }), NOW)
    expect(first.creditScore).toBe(55)
    expect(first.noShowCount).toBe(1)
    expect(first.bannedUntil).not.toBeNull()
  })

  it('已有未到期禁约不会被重复延长', () => {
    const existing = '2026-11-08T12:00:00.000Z'
    const result = applyNoShow(student({ creditScore: 55, noShowCount: 1, bannedUntil: existing }), NOW)
    expect(result.bannedUntil).toBe(existing)
  })

  it('历史禁约已过期时，再次触发会重新计算 7 天', () => {
    const expired = '2026-10-01T12:00:00.000Z'
    const result = applyNoShow(student({ creditScore: 55, noShowCount: 1, bannedUntil: expired }), NOW)
    expect(result.bannedUntil).toBe('2026-11-10T12:00:00.000Z')
  })

  it('缺失信用分时按初始分 100 计算', () => {
    const result = applyNoShow({ noShowCount: 0 }, NOW)
    expect(result.creditScore).toBe(90)
  })
})

describe('签到加分与禁约判定', () => {
  it('签到加 2 分且不超过上限 100', () => {
    expect(applyCheckIn(student({ creditScore: 90 })).creditScore).toBe(92)
    expect(applyCheckIn(student({ creditScore: 100 })).creditScore).toBe(100)
    expect(applyCheckIn({ creditScore: undefined }).creditScore).toBe(100)
  })

  it('isBanned 只对未来禁约时间返回 true', () => {
    expect(isBanned(student(), NOW)).toBe(false)
    expect(isBanned(null, NOW)).toBe(false)
    expect(isBanned({ bannedUntil: 'not-a-date' }, NOW)).toBe(false)
    expect(isBanned({ bannedUntil: '2026-11-04T00:00:00.000Z' }, NOW)).toBe(true)
    expect(isBanned({ bannedUntil: '2026-11-01T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('banRemainingDays 向上取整剩余天数，未禁约返回 0', () => {
    expect(banRemainingDays({ bannedUntil: '2026-11-04T12:00:00.000Z' }, NOW)).toBe(1)
    expect(banRemainingDays({ bannedUntil: '2026-11-04T12:00:01.000Z' }, NOW)).toBe(2)
    expect(banRemainingDays(student(), NOW)).toBe(0)
  })

  it('canReserve 与禁约状态相反', () => {
    expect(canReserve(student(), NOW)).toBe(true)
    expect(canReserve({ bannedUntil: '2026-11-05T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('liftBan 清空禁约字段并保留其他信息', () => {
    const banned = student({ creditScore: 50, bannedUntil: '2026-11-10T00:00:00.000Z', banReason: '爽约 3 次' })
    const lifted = liftBan(banned)
    expect(lifted.bannedUntil).toBeNull()
    expect(lifted.banReason).toBeNull()
    expect(lifted.creditScore).toBe(50)
    expect(lifted.id).toBe('user-1')
  })
})