import { describe, expect, it } from 'vitest'
import { BOOKING_RULES, canCancel, canCheckIn, describeReservationWindow, getNoShowCandidates, isNoShow, settleReservation, validateReservation } from '../../src/domain/reservation.js'
import { RESERVATION_STATUS } from '../../src/domain/conflict.js'

const NOW = new Date(2026, 10, 3, 9, 0, 0)
const ROOM = { id: 'room-1', openTime: '08:00', closeTime: '22:00' }
const SEAT = { id: 'seat-1', roomId: 'room-1', status: 'available' }
const USER = { id: 'user-1', creditScore: 100, bannedUntil: null }

function candidate(overrides = {}) {
  return {
    userId: 'user-1',
    seatId: 'seat-1',
    date: '2026-11-03',
    startTime: '09:00',
    endTime: '11:00',
    ...overrides
  }
}

function context(overrides = {}) {
  return {
    seat: SEAT,
    room: ROOM,
    user: USER,
    reservations: [],
    now: NOW,
    ...overrides
  }
}

describe('预约合法性校验', () => {
  it('合法预约通过校验', () => {
    const result = validateReservation(candidate(), context())
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('缺少座位、日期与时段时逐项报错', () => {
    const result = validateReservation({}, context())
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('请选择座位')
    expect(result.errors).toContain('请选择预约日期')
    expect(result.errors).toContain('请选择预约时段')
  })

  it('拒绝过去的日期与格式不正确的日期', () => {
    const past = validateReservation(candidate({ date: '2026-11-02' }), context())
    expect(past.errors).toContain('不能预约过去的日期')
    const invalid = validateReservation(candidate({ date: '2026/11/04' }), context())
    expect(invalid.errors).toContain('预约日期格式不正确')
  })

  it('最多允许提前 7 天（含当天）', () => {
    const last = validateReservation(candidate({ date: '2026-11-09' }), context())
    expect(last.ok).toBe(true)
    const beyond = validateReservation(candidate({ date: '2026-11-10' }), context())
    expect(beyond.ok).toBe(false)
    expect(beyond.errors).toContain('最多可提前 7 天预约')
  })

  it('时间必须按 30 分钟对齐', () => {
    const result = validateReservation(candidate({ startTime: '09:10' }), context())
    expect(result.errors).toContain('预约时间必须按 30 分钟对齐')
  })

  it('结束时间必须晚于开始时间', () => {
    const result = validateReservation(candidate({ startTime: '10:00', endTime: '10:00' }), context())
    expect(result.errors).toContain('结束时间必须晚于开始时间')
  })

  it('单次预约时长需在 30-240 分钟之间', () => {
    const tooShort = validateReservation(candidate({ startTime: '09:00', endTime: '09:20' }), context())
    expect(tooShort.errors).toContain('单次预约不得少于 30 分钟')
    const tooLong = validateReservation(candidate({ startTime: '08:00', endTime: '12:30' }), context())
    expect(tooLong.errors).toContain('单次预约不得超过 240 分钟')
  })

  it('预约时段必须落在自习室开放时间内', () => {
    const result = validateReservation(candidate({ startTime: '07:30', endTime: '09:00' }), context())
    expect(result.errors).toContain('预约时段须在开放时间 08:00-22:00 内')
  })

  it('校验座位归属与停用状态', () => {
    const wrongRoom = validateReservation(candidate(), context({ seat: { ...SEAT, roomId: 'room-2' } }))
    expect(wrongRoom.errors).toContain('座位不属于所选自习室')
    const disabled = validateReservation(candidate(), context({ seat: { ...SEAT, status: 'disabled' } }))
    expect(disabled.errors).toContain('该座位已停用')
  })

  it('当天已开始的时段不可预约，未开始的时段仍可预约', () => {
    const started = validateReservation(
      candidate({ startTime: '09:00', endTime: '11:00' }),
      context({ now: new Date(2026, 10, 3, 9, 30) })
    )
    expect(started.errors).toContain('不能预约已经开始的时段')

    const upcoming = validateReservation(
      candidate({ startTime: '10:00', endTime: '11:00' }),
      context({ now: new Date(2026, 10, 3, 9, 30) })
    )
    expect(upcoming.ok).toBe(true)
  })

  it('禁约期内的用户不能发起预约', () => {
    const result = validateReservation(
      candidate(),
      context({ user: { ...USER, bannedUntil: new Date(2026, 10, 5).toISOString() } })
    )
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('你当前处于爽约禁约期，暂不能预约')
  })

  it('同座位时段重叠会被拒绝', () => {
    const reservations = [
      {
        id: 'r-exist',
        userId: 'user-2',
        seatId: 'seat-1',
        date: '2026-11-03',
        startTime: '10:00',
        endTime: '12:00',
        status: RESERVATION_STATUS.RESERVED
      }
    ]
    const result = validateReservation(candidate(), context({ reservations }))
    expect(result.errors).toContain('该座位在所选时段已被预约')
    expect(result.errors).not.toContain('你在所选时段已有其他预约')
  })

  it('同一用户时段重叠会被拒绝（即使座位不同）', () => {
    const reservations = [
      {
        id: 'r-own',
        userId: 'user-1',
        seatId: 'seat-9',
        date: '2026-11-03',
        startTime: '10:00',
        endTime: '12:00',
        status: RESERVATION_STATUS.RESERVED
      }
    ]
    const result = validateReservation(candidate(), context({ reservations }))
    expect(result.errors).toContain('你在所选时段已有其他预约')
    expect(result.errors).not.toContain('该座位在所选时段已被预约')
  })
})

describe('签到窗口', () => {
  const reservation = {
    id: 'r1',
    date: '2026-11-03',
    startTime: '09:00',
    endTime: '10:00',
    status: RESERVATION_STATUS.RESERVED
  }

  it('开始前 15 分钟至开始后 15 分钟内可签到', () => {
    expect(canCheckIn(reservation, new Date(2026, 10, 3, 8, 45))).toBe(true)
    expect(canCheckIn(reservation, new Date(2026, 10, 3, 9, 0))).toBe(true)
    expect(canCheckIn(reservation, new Date(2026, 10, 3, 9, 15))).toBe(true)
  })

  it('窗口之外不可签到', () => {
    expect(canCheckIn(reservation, new Date(2026, 10, 3, 8, 44))).toBe(false)
    expect(canCheckIn(reservation, new Date(2026, 10, 3, 9, 16))).toBe(false)
    expect(canCheckIn(reservation, new Date(2026, 10, 4, 9, 0))).toBe(false)
  })

  it('非待签到状态或非法时间不可签到', () => {
    expect(canCheckIn({ ...reservation, status: RESERVATION_STATUS.CHECKED_IN }, new Date(2026, 10, 3, 9, 0))).toBe(false)
    expect(canCheckIn({ ...reservation, startTime: 'bad' }, new Date(2026, 10, 3, 9, 0))).toBe(false)
    expect(canCheckIn(null, new Date(2026, 10, 3, 9, 0))).toBe(false)
  })

  it('签到窗口常量与业务规则保持一致', () => {
    expect(BOOKING_RULES.checkInWindowMinutes).toBe(15)
    expect(BOOKING_RULES.cancelDeadlineMinutes).toBe(30)
    expect(BOOKING_RULES.maxDurationMinutes).toBe(240)
  })
})

describe('取消规则', () => {
  const reservation = {
    id: 'r1',
    date: '2026-11-03',
    startTime: '09:00',
    endTime: '10:00',
    status: RESERVATION_STATUS.RESERVED
  }

  it('开始前 30 分钟（含）可取消', () => {
    expect(canCancel(reservation, new Date(2026, 10, 3, 8, 30))).toBe(true)
    expect(canCancel(reservation, new Date(2026, 10, 3, 8, 29))).toBe(true)
    expect(canCancel(reservation, new Date(2026, 10, 3, 7, 0))).toBe(true)
  })

  it('开始前 30 分钟内或已签到不可取消', () => {
    expect(canCancel(reservation, new Date(2026, 10, 3, 8, 31))).toBe(false)
    expect(canCancel(reservation, new Date(2026, 10, 3, 9, 0))).toBe(false)
    expect(canCancel({ ...reservation, status: RESERVATION_STATUS.CHECKED_IN }, new Date(2026, 10, 3, 7, 0))).toBe(false)
  })

  it('非法开始时间不可取消', () => {
    expect(canCancel({ ...reservation, startTime: 'bad' }, new Date(2026, 10, 3, 7, 0))).toBe(false)
    expect(canCancel(null, new Date(2026, 10, 3, 7, 0))).toBe(false)
  })
})

describe('爽约判定', () => {
  const reservation = {
    id: 'r1',
    date: '2026-11-03',
    startTime: '09:00',
    endTime: '10:00',
    status: RESERVATION_STATUS.RESERVED
  }

  it('超过开始后 15 分钟仍未签到即判爽约', () => {
    expect(isNoShow(reservation, new Date(2026, 10, 3, 9, 15))).toBe(false)
    expect(isNoShow(reservation, new Date(2026, 10, 3, 9, 16))).toBe(true)
    expect(isNoShow(reservation, new Date(2026, 10, 3, 8, 0))).toBe(false)
  })

  it('非待签到状态、非法时间与空记录不判爽约', () => {
    expect(isNoShow({ ...reservation, status: RESERVATION_STATUS.CHECKED_IN }, new Date(2026, 10, 3, 9, 30))).toBe(false)
    expect(isNoShow({ ...reservation, startTime: 'bad' }, new Date(2026, 10, 3, 9, 30))).toBe(false)
    expect(isNoShow(null, new Date(2026, 10, 3, 9, 30))).toBe(false)
  })

  it('批量筛查只返回已超时未签到的预约', () => {
    const list = [
      reservation,
      { ...reservation, id: 'r2', date: '2026-11-04' },
      { ...reservation, id: 'r3', status: RESERVATION_STATUS.CHECKED_IN },
      { ...reservation, id: 'r4', startTime: '10:00', endTime: '11:00' }
    ]
    const candidates = getNoShowCandidates(list, new Date(2026, 10, 3, 9, 30))
    expect(candidates.map((item) => item.id)).toEqual(['r1'])
  })
})

describe('预约结算与描述', () => {
  const checkedIn = {
    id: 'r1',
    date: '2026-11-03',
    startTime: '09:00',
    endTime: '10:00',
    status: RESERVATION_STATUS.CHECKED_IN
  }

  it('已签到且超过结束时间自动结算为已完成', () => {
    const settled = settleReservation(checkedIn, new Date(2026, 10, 3, 10, 30))
    expect(settled.status).toBe(RESERVATION_STATUS.COMPLETED)
    expect(settled.completedAt).toBe(new Date(2026, 10, 3, 10, 30).toISOString())
  })

  it('未到结束时间或其他状态保持原样', () => {
    expect(settleReservation(checkedIn, new Date(2026, 10, 3, 9, 30))).toBe(checkedIn)
    expect(settleReservation({ ...checkedIn, status: RESERVATION_STATUS.RESERVED }, new Date(2026, 10, 3, 11, 0)).status).toBe(
      RESERVATION_STATUS.RESERVED
    )
    expect(settleReservation({ ...checkedIn, endTime: 'bad' }, new Date(2026, 10, 3, 11, 0)).status).toBe(
      RESERVATION_STATUS.CHECKED_IN
    )
    expect(settleReservation(null)).toBeNull()
  })

  it('describeReservationWindow 输出日期与时段', () => {
    expect(describeReservationWindow(checkedIn)).toBe('2026-11-03 09:00-10:00')
    expect(describeReservationWindow(null)).toBe('')
  })
})