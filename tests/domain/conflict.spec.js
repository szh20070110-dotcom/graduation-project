import { describe, expect, it } from 'vitest'
import {
  ACTIVE_STATUSES,
  RESERVATION_STATUS,
  STATUS_META,
  detectConflicts,
  findSeatConflicts,
  findUserConflicts,
  isActiveReservation
} from '../../src/domain/conflict.js'

const RESERVATIONS = [
  {
    id: 'r1',
    userId: 'u1',
    seatId: 'seat-01',
    date: '2026-11-04',
    startTime: '09:00',
    endTime: '11:00',
    status: RESERVATION_STATUS.RESERVED
  },
  {
    id: 'r2',
    userId: 'u1',
    seatId: 'seat-02',
    date: '2026-11-04',
    startTime: '10:00',
    endTime: '12:00',
    status: RESERVATION_STATUS.CHECKED_IN
  },
  {
    id: 'r3',
    userId: 'u2',
    seatId: 'seat-01',
    date: '2026-11-04',
    startTime: '14:00',
    endTime: '16:00',
    status: RESERVATION_STATUS.RESERVED
  },
  {
    id: 'r4',
    userId: 'u3',
    seatId: 'seat-01',
    date: '2026-11-04',
    startTime: '09:00',
    endTime: '11:00',
    status: RESERVATION_STATUS.CANCELLED
  },
  {
    id: 'r5',
    userId: 'u4',
    seatId: 'seat-01',
    date: '2026-11-05',
    startTime: '09:00',
    endTime: '11:00',
    status: RESERVATION_STATUS.RESERVED
  },
  {
    id: 'r6',
    userId: 'u5',
    seatId: 'seat-03',
    date: '2026-11-04',
    startTime: '09:00',
    endTime: '11:00',
    status: RESERVATION_STATUS.NO_SHOW
  }
]

const candidate = {
  id: 'new',
  userId: 'u9',
  seatId: 'seat-01',
  date: '2026-11-04',
  startTime: '10:00',
  endTime: '12:00'
}

describe('预约状态定义', () => {
  it('仅 reserved 与 checked_in 视为活跃预约', () => {
    expect(ACTIVE_STATUSES).toEqual([RESERVATION_STATUS.RESERVED, RESERVATION_STATUS.CHECKED_IN])
    expect(isActiveReservation({ status: RESERVATION_STATUS.RESERVED })).toBe(true)
    expect(isActiveReservation({ status: RESERVATION_STATUS.CHECKED_IN })).toBe(true)
    expect(isActiveReservation({ status: RESERVATION_STATUS.CANCELLED })).toBe(false)
    expect(isActiveReservation({ status: RESERVATION_STATUS.NO_SHOW })).toBe(false)
    expect(isActiveReservation({ status: RESERVATION_STATUS.COMPLETED })).toBe(false)
    expect(isActiveReservation(null)).toBe(false)
  })

  it('状态元数据覆盖全部状态且带中文文案', () => {
    const statuses = Object.values(RESERVATION_STATUS)
    expect(Object.keys(STATUS_META).sort()).toEqual([...statuses].sort())
    expect(STATUS_META.no_show.label).toBe('爽约')
    expect(STATUS_META.checked_in.tone).toBe('success')
  })
})

describe('座位冲突检测', () => {
  it('同座位、同日期、时段重叠的活跃预约会被命中', () => {
    const conflicts = findSeatConflicts(candidate, RESERVATIONS)
    expect(conflicts.map((item) => item.id)).toEqual(['r1'])
  })

  it('已取消、已爽约、不同日期与不同座位的预约不构成冲突', () => {
    const ids = findSeatConflicts(candidate, RESERVATIONS).map((item) => item.id)
    expect(ids).not.toContain('r4')
    expect(ids).not.toContain('r6')
    expect(ids).not.toContain('r5')
    expect(ids).not.toContain('r3')
  })

  it('首尾相接的相邻时段不判为冲突', () => {
    const adjacent = { ...candidate, startTime: '11:00', endTime: '12:00' }
    expect(findSeatConflicts(adjacent, RESERVATIONS)).toEqual([])
  })

  it('候选预约自身不会被判定为冲突（id 排除）', () => {
    const editing = { ...candidate, id: 'r1', startTime: '09:00', endTime: '11:00' }
    expect(findSeatConflicts(editing, RESERVATIONS)).toEqual([])
  })
})

describe('用户冲突检测', () => {
  it('同一用户、同日期、不同座位的重叠预约会被命中', () => {
    const userCandidate = {
      id: 'new',
      userId: 'u1',
      seatId: 'seat-09',
      date: '2026-11-04',
      startTime: '09:30',
      endTime: '10:30'
    }
    const conflicts = findUserConflicts(userCandidate, RESERVATIONS)
    expect(conflicts.map((item) => item.id)).toEqual(['r1', 'r2'])
  })

  it('其他用户的预约不影响当前用户', () => {
    const userCandidate = {
      id: 'new',
      userId: 'u2',
      seatId: 'seat-09',
      date: '2026-11-04',
      startTime: '09:30',
      endTime: '10:30'
    }
    expect(findUserConflicts(userCandidate, RESERVATIONS)).toEqual([])
  })
})

describe('冲突聚合', () => {
  it('默认同时执行座位冲突与用户冲突检查', () => {
    const crossCandidate = {
      id: 'new',
      userId: 'u1',
      seatId: 'seat-01',
      date: '2026-11-04',
      startTime: '10:00',
      endTime: '11:00'
    }
    const conflicts = detectConflicts(crossCandidate, RESERVATIONS)
    expect(conflicts).toHaveLength(3)
    expect(conflicts.filter((item) => item.type === 'seat').map((item) => item.reservation.id)).toEqual(['r1'])
    expect(conflicts.filter((item) => item.type === 'user').map((item) => item.reservation.id)).toEqual(['r1', 'r2'])
  })

  it('可通过 checkSeat / checkUser 关闭单项检查', () => {
    expect(detectConflicts(candidate, RESERVATIONS, { checkUser: false })).toHaveLength(1)
    expect(detectConflicts(candidate, RESERVATIONS, { checkSeat: false })).toHaveLength(0)
    expect(detectConflicts(candidate, [], {})).toEqual([])
  })
})