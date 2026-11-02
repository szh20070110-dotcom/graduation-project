import { RESERVATION_STATUS } from './conflict.js'
import { durationMinutes, splitRange, toDateKey } from './time.js'

export function countByStatus(reservations = []) {
  const counts = {
    total: reservations.length,
    reserved: 0,
    checked_in: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0
  }
  for (const item of reservations) {
    if (counts[item.status] !== undefined) counts[item.status] += 1
  }
  return counts
}

export function buildOverview(reservations = [], users = [], now = new Date()) {
  const today = toDateKey(now)
  const todayReservations = reservations.filter((item) => item.date === today)
  const counts = countByStatus(reservations)
  const attended = counts.checked_in + counts.completed
  const noShow = counts.no_show
  const valid = attended + noShow
  return {
    total: counts.total,
    today: todayReservations.length,
    active: counts.reserved + counts.checked_in,
    checkedIn: attended,
    noShow,
    cancelled: counts.cancelled,
    completed: counts.completed,
    checkInRate: valid === 0 ? 0 : Math.round((attended / valid) * 100),
    noShowRate: valid === 0 ? 0 : Math.round((noShow / valid) * 100),
    bannedUsers: users.filter((user) => user.bannedUntil).length,
    atRiskUsers: users.filter((user) => user.noShowCount > 0).length
  }
}

export function occupancyByRoom({ rooms = [], seats = [], reservations = [], date }) {
  return rooms
    .filter((room) => room.status !== 'closed')
    .map((room) => {
      const roomSeats = seats.filter((seat) => seat.roomId === room.id && seat.status !== 'disabled')
      const openMinutes = Math.max(durationMinutes(room.openTime, room.closeTime), 0)
      const capacity = roomSeats.length * openMinutes
      const booked = reservations
        .filter((item) => item.date === date && item.status !== RESERVATION_STATUS.CANCELLED && item.status !== RESERVATION_STATUS.NO_SHOW)
        .filter((item) => roomSeats.some((seat) => seat.id === item.seatId))
        .reduce((sum, item) => sum + Math.max(durationMinutes(item.startTime, item.endTime), 0), 0)
      return {
        id: room.id,
        name: room.name,
        building: room.building,
        seatCount: roomSeats.length,
        bookedMinutes: booked,
        capacityMinutes: capacity,
        rate: capacity === 0 ? 0 : Math.min(100, Math.round((booked / capacity) * 100))
      }
    })
}

export function hourlyHeatmap(reservations = [], date, rooms = []) {
  const hours = new Map()
  for (let hour = 8; hour < 22; hour += 1) {
    hours.set(hour, { hour: `${String(hour).padStart(2, '0')}:00`, count: 0 })
  }
  for (const item of reservations) {
    if (item.date !== date) continue
    if (item.status === RESERVATION_STATUS.CANCELLED || item.status === RESERVATION_STATUS.NO_SHOW) continue
    const slots = splitRange(item.startTime, item.endTime, 60)
    for (const slot of slots) {
      const hour = Number(slot.start.slice(0, 2))
      if (hours.has(hour)) hours.get(hour).count += 1
    }
  }
  return [...hours.values()]
}

export function roomSeatStatus({ room, seats = [], reservations = [], date }) {
  const roomSeats = seats.filter((seat) => seat.roomId === room.id)
  return roomSeats.map((seat) => ({
    ...seat,
    activeCount: reservations.filter(
      (item) =>
        item.seatId === seat.id &&
        item.date === date &&
        (item.status === RESERVATION_STATUS.RESERVED || item.status === RESERVATION_STATUS.CHECKED_IN)
    ).length
  }))
}