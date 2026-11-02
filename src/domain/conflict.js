import { rangesOverlap } from './time.js'

export const RESERVATION_STATUS = Object.freeze({
  RESERVED: 'reserved',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
})

export const ACTIVE_STATUSES = Object.freeze([RESERVATION_STATUS.RESERVED, RESERVATION_STATUS.CHECKED_IN])

export const STATUS_META = Object.freeze({
  reserved: { label: '待签到', tone: 'info' },
  checked_in: { label: '已签到', tone: 'success' },
  completed: { label: '已完成', tone: 'neutral' },
  cancelled: { label: '已取消', tone: 'muted' },
  no_show: { label: '爽约', tone: 'danger' }
})

export function isActiveReservation(reservation) {
  return Boolean(reservation) && ACTIVE_STATUSES.includes(reservation.status)
}

export function findSeatConflicts(candidate, reservations) {
  return reservations.filter(
    (item) =>
      item.id !== candidate.id &&
      item.seatId === candidate.seatId &&
      item.date === candidate.date &&
      isActiveReservation(item) &&
      rangesOverlap(candidate.startTime, candidate.endTime, item.startTime, item.endTime)
  )
}

export function findUserConflicts(candidate, reservations) {
  return reservations.filter(
    (item) =>
      item.id !== candidate.id &&
      item.userId === candidate.userId &&
      item.date === candidate.date &&
      isActiveReservation(item) &&
      rangesOverlap(candidate.startTime, candidate.endTime, item.startTime, item.endTime)
  )
}

export function detectConflicts(candidate, reservations, options = {}) {
  const result = []
  if (options.checkSeat !== false) {
    findSeatConflicts(candidate, reservations).forEach((item) => {
      result.push({ type: 'seat', reservation: item })
    })
  }
  if (options.checkUser !== false) {
    findUserConflicts(candidate, reservations).forEach((item) => {
      result.push({ type: 'user', reservation: item })
    })
  }
  return result
}