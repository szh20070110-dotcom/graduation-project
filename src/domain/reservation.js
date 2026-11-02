import { detectConflicts, RESERVATION_STATUS } from './conflict.js'
import { canReserve } from './credit.js'
import {
  addDays,
  durationMinutes,
  isAlignedToSlot,
  isWithinRange,
  parseDateKey,
  toDateKey,
  toDateTime,
  timeToMinutes
} from './time.js'

export const BOOKING_RULES = Object.freeze({
  minDurationMinutes: 30,
  maxDurationMinutes: 240,
  advanceDays: 7,
  checkInWindowMinutes: 15,
  cancelDeadlineMinutes: 30
})

export function validateReservation(candidate, context = {}) {
  const errors = []
  const {
    seat,
    room,
    user,
    reservations = [],
    now = new Date(),
    rules = BOOKING_RULES
  } = context

  if (!candidate || !candidate.seatId) errors.push('请选择座位')
  if (!candidate?.date) errors.push('请选择预约日期')
  if (!candidate?.startTime || !candidate?.endTime) errors.push('请选择预约时段')

  const today = toDateKey(now)
  if (candidate?.date) {
    if (!parseDateKey(candidate.date)) {
      errors.push('预约日期格式不正确')
    } else if (candidate.date < today) {
      errors.push('不能预约过去的日期')
    } else if (candidate.date > addDays(today, rules.advanceDays - 1)) {
      errors.push(`最多可提前 ${rules.advanceDays} 天预约`)
    }
  }

  const start = candidate?.startTime
  const end = candidate?.endTime
  if (start && end) {
    if (!isAlignedToSlot(start) || !isAlignedToSlot(end)) {
      errors.push('预约时间必须按 30 分钟对齐')
    }
    if (durationMinutes(start, end) <= 0) {
      errors.push('结束时间必须晚于开始时间')
    } else {
      const duration = durationMinutes(start, end)
      if (duration < rules.minDurationMinutes) errors.push(`单次预约不得少于 ${rules.minDurationMinutes} 分钟`)
      if (duration > rules.maxDurationMinutes) errors.push(`单次预约不得超过 ${rules.maxDurationMinutes} 分钟`)
    }
    if (room && !isWithinRange(start, end, room.openTime, room.closeTime)) {
      errors.push(`预约时段须在开放时间 ${room.openTime}-${room.closeTime} 内`)
    }
    if (candidate.date === today) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      if (timeToMinutes(start) < nowMinutes) errors.push('不能预约已经开始的时段')
    }
  }

  if (seat && room && seat.roomId !== room.id) errors.push('座位不属于所选自习室')
  if (seat && seat.status === 'disabled') errors.push('该座位已停用')
  if (user && !canReserve(user, now)) errors.push('你当前处于爽约禁约期，暂不能预约')

  if (seat && start && end) {
    const conflicts = detectConflicts({ ...candidate, seatId: seat.id }, reservations)
    if (conflicts.some((item) => item.type === 'seat')) errors.push('该座位在所选时段已被预约')
    if (conflicts.some((item) => item.type === 'user')) errors.push('你在所选时段已有其他预约')
  }

  return { ok: errors.length === 0, errors }
}

export function canCheckIn(reservation, now = new Date(), rules = BOOKING_RULES) {
  if (!reservation || reservation.status !== RESERVATION_STATUS.RESERVED) return false
  if (reservation.date !== toDateKey(now)) return false
  const start = toDateTime(reservation.date, reservation.startTime)
  const end = toDateTime(reservation.date, reservation.endTime)
  if (!start || !end) return false
  const windowStart = start.getTime() - rules.checkInWindowMinutes * 60 * 1000
  const windowEnd = start.getTime() + rules.checkInWindowMinutes * 60 * 1000
  return now.getTime() >= windowStart && now.getTime() <= windowEnd
}

export function canCancel(reservation, now = new Date(), rules = BOOKING_RULES) {
  if (!reservation || reservation.status !== RESERVATION_STATUS.RESERVED) return false
  const start = toDateTime(reservation.date, reservation.startTime)
  if (!start) return false
  return now.getTime() <= start.getTime() - rules.cancelDeadlineMinutes * 60 * 1000
}

export function isNoShow(reservation, now = new Date(), rules = BOOKING_RULES) {
  if (!reservation || reservation.status !== RESERVATION_STATUS.RESERVED) return false
  const start = toDateTime(reservation.date, reservation.startTime)
  if (!start) return false
  return now.getTime() > start.getTime() + rules.checkInWindowMinutes * 60 * 1000
}

export function getNoShowCandidates(reservations, now = new Date(), rules = BOOKING_RULES) {
  return reservations.filter((item) => isNoShow(item, now, rules))
}

export function settleReservation(reservation, now = new Date()) {
  if (!reservation) return null
  if (reservation.status === RESERVATION_STATUS.CHECKED_IN) {
    const end = toDateTime(reservation.date, reservation.endTime)
    if (end && now.getTime() > end.getTime()) {
      return { ...reservation, status: RESERVATION_STATUS.COMPLETED, completedAt: now.toISOString() }
    }
  }
  return reservation
}

export function describeReservationWindow(reservation) {
  if (!reservation) return ''
  return `${reservation.date} ${reservation.startTime}-${reservation.endTime}`
}