import { findSeatConflicts } from './conflict.js'
import { durationMinutes, splitRange, toDateKey } from './time.js'

export function seatPreferenceScore(seat, preference = {}) {
  let score = 0
  if (preference.socket && seat.hasSocket) score += 3
  if (preference.window && seat.isWindow) score += 2
  if (preference.quiet && seat.zone === 'quiet') score += 1
  return score
}

export function listAvailableSeats({ roomId, date, startTime, endTime, seats = [], reservations = [], excludeId }) {
  const candidateBase = { id: excludeId, date, startTime, endTime }
  return seats
    .filter((seat) => seat.roomId === roomId && seat.status !== 'disabled')
    .filter(
      (seat) =>
        findSeatConflicts({ ...candidateBase, seatId: seat.id }, reservations).length === 0
    )
}

export function recommendSeats(params) {
  const { preference = {}, limit = 3 } = params
  const available = listAvailableSeats(params)
  return [...available]
    .sort((a, b) => {
      const diff = seatPreferenceScore(b, preference) - seatPreferenceScore(a, preference)
      if (diff !== 0) return diff
      return a.code.localeCompare(b.code)
    })
    .slice(0, limit)
}

export function pickBestSeat(params) {
  const [best] = recommendSeats({ ...params, limit: 1 })
  return best || null
}

export function countAvailableSeats({ room, date, startTime, endTime, seats = [], reservations = [] }) {
  const roomSeats = seats.filter((seat) => seat.roomId === room.id && seat.status !== 'disabled')
  const available = listAvailableSeats({
    roomId: room.id,
    date,
    startTime,
    endTime,
    seats: roomSeats,
    reservations
  })
  return { total: roomSeats.length, available: available.length, occupied: roomSeats.length - available.length }
}

export function seatSlotUsage({ room, date, startTime, endTime, seats = [], reservations = [] }) {
  const roomSeats = seats.filter((seat) => seat.roomId === room.id && seat.status !== 'disabled')
  const slots = splitRange(startTime, endTime).length
  if (!slots || !roomSeats.length) return { totalSlots: 0, usedSlots: 0, rate: 0 }

  let usedSlots = 0
  for (const seat of roomSeats) {
    for (const slot of splitRange(startTime, endTime)) {
      const conflicts = findSeatConflicts(
        { id: undefined, seatId: seat.id, date, startTime: slot.start, endTime: slot.end },
        reservations
      )
      if (conflicts.length) usedSlots += 1
    }
  }
  const totalSlots = roomSeats.length * slots
  return {
    totalSlots,
    usedSlots,
    rate: totalSlots === 0 ? 0 : Math.round((usedSlots / totalSlots) * 100)
  }
}

export function dailyOccupancyRate({ rooms = [], seats = [], reservations = [], date }) {
  let totalMinutes = 0
  let busyMinutes = 0
  for (const room of rooms) {
    if (room.status === 'closed') continue
    const roomSeats = seats.filter((seat) => seat.roomId === room.id && seat.status !== 'disabled')
    const openMinutes = durationMinutes(room.openTime, room.closeTime)
    totalMinutes += roomSeats.length * Math.max(openMinutes, 0)
    const active = reservations.filter(
      (item) => item.date === date && item.status !== 'cancelled' && item.status !== 'no_show'
    )
    for (const item of active) {
      const seat = seats.find((candidate) => candidate.id === item.seatId)
      if (seat && seat.roomId === room.id) {
        busyMinutes += Math.max(durationMinutes(item.startTime, item.endTime), 0)
      }
    }
  }
  return {
    totalMinutes,
    busyMinutes,
    rate: totalMinutes === 0 ? 0 : Math.round((busyMinutes / totalMinutes) * 100)
  }
}

export function todayAvailabilitySummary({ rooms = [], seats = [], reservations = [], now = new Date() }) {
  const date = toDateKey(now)
  return rooms
    .filter((room) => room.status !== 'closed')
    .map((room) => ({
      roomId: room.id,
      roomName: room.name,
      total: seats.filter((seat) => seat.roomId === room.id && seat.status !== 'disabled').length,
      activeReservations: reservations.filter(
        (item) => item.date === date && item.status !== 'cancelled' && item.status !== 'no_show' &&
          seats.some((seat) => seat.id === item.seatId && seat.roomId === room.id)
      ).length
    }))
}