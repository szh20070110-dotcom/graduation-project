import { describe, expect, it } from 'vitest'
import {
  countAvailableSeats,
  dailyOccupancyRate,
  listAvailableSeats,
  pickBestSeat,
  recommendSeats,
  seatPreferenceScore,
  seatSlotUsage,
  todayAvailabilitySummary
} from '../../src/domain/allocation.js'
import { RESERVATION_STATUS } from '../../src/domain/conflict.js'

const ROOMS = [
  { id: 'room-1', name: '静思苑 A101', building: '静思苑', openTime: '08:00', closeTime: '22:00', status: 'open' },
  { id: 'room-2', name: '图书馆 B201', building: '图书馆', openTime: '08:00', closeTime: '22:00', status: 'closed' }
]

const SEATS = [
  { id: 'seat-1', roomId: 'room-1', code: 'A-01', isWindow: true, hasSocket: true, zone: 'quiet', status: 'available' },
  { id: 'seat-2', roomId: 'room-1', code: 'A-02', isWindow: false, hasSocket: true, zone: 'normal', status: 'available' },
  { id: 'seat-3', roomId: 'room-1', code: 'A-03', isWindow: false, hasSocket: false, zone: 'normal', status: 'disabled' },
  { id: 'seat-4', roomId: 'room-2', code: 'B-01', isWindow: true, hasSocket: true, zone: 'quiet', status: 'available' }
]

const RESERVATIONS = [
  {
    id: 'r1',
    userId: 'user-2',
    seatId: 'seat-1',
    roomId: 'room-1',
    date: '2026-11-04',
    startTime: '09:00',
    endTime: '11:00',
    status: RESERVATION_STATUS.RESERVED
  },
  {
    id: 'r2',
    userId: 'user-3',
    seatId: 'seat-2',
    roomId: 'room-1',
    date: '2026-11-04',
    startTime: '10:00',
    endTime: '12:00',
    status: RESERVATION_STATUS.CANCELLED
  }
]

describe('座位偏好评分', () => {
  it('插座/靠窗/安静区分别计 3/2/1 分', () => {
    expect(seatPreferenceScore(SEATS[0], { socket: true, window: true, quiet: true })).toBe(6)
    expect(seatPreferenceScore(SEATS[0], { socket: true })).toBe(3)
    expect(seatPreferenceScore(SEATS[1], { window: true })).toBe(0)
    expect(seatPreferenceScore(SEATS[1], { quiet: true })).toBe(0)
  })

  it('无偏好时所有座位同分', () => {
    expect(seatPreferenceScore(SEATS[0])).toBe(0)
    expect(seatPreferenceScore(SEATS[1], {})).toBe(0)
  })
})

describe('空闲座位查询', () => {
  it('只返回目标自习室中未被占用且未停用的座位', () => {
    const seats = listAvailableSeats({
      roomId: 'room-1',
      date: '2026-11-04',
      startTime: '09:00',
      endTime: '10:00',
      seats: SEATS,
      reservations: RESERVATIONS
    })
    expect(seats.map((seat) => seat.id)).toEqual(['seat-2'])
  })

  it('取消预约不占用座位', () => {
    const seats = listAvailableSeats({
      roomId: 'room-1',
      date: '2026-11-04',
      startTime: '10:00',
      endTime: '11:00',
      seats: SEATS,
      reservations: RESERVATIONS
    })
    expect(seats.map((seat) => seat.id)).toEqual(['seat-2'])
  })

  it('excludeId 用于编辑场景，排除自身预约', () => {
    const seats = listAvailableSeats({
      roomId: 'room-1',
      date: '2026-11-04',
      startTime: '09:00',
      endTime: '10:00',
      seats: SEATS,
      reservations: RESERVATIONS,
      excludeId: 'r1'
    })
    expect(seats.map((seat) => seat.id)).toEqual(['seat-1', 'seat-2'])
  })

  it('其他日期不受影响', () => {
    const seats = listAvailableSeats({
      roomId: 'room-1',
      date: '2026-11-05',
      startTime: '09:00',
      endTime: '10:00',
      seats: SEATS,
      reservations: RESERVATIONS
    })
    expect(seats.map((seat) => seat.id)).toEqual(['seat-1', 'seat-2'])
  })
})

describe('座位推荐', () => {
  const base = {
    roomId: 'room-1',
    date: '2026-11-04',
    startTime: '13:00',
    endTime: '14:00',
    seats: SEATS,
    reservations: RESERVATIONS
  }

  it('按偏好得分降序推荐，默认返回 3 个', () => {
    const seats = recommendSeats({ ...base, preference: { socket: true, window: true, quiet: true } })
    expect(seats.map((seat) => seat.id)).toEqual(['seat-1', 'seat-2'])
  })

  it('同分时按座位编号升序，limit 生效', () => {
    const seats = recommendSeats({ ...base, preference: {}, limit: 1 })
    expect(seats.map((seat) => seat.id)).toEqual(['seat-1'])
  })

  it('pickBestSeat 返回最优座位，无可用时返回 null', () => {
    const best = pickBestSeat({ ...base, preference: { socket: true } })
    expect(best.id).toBe('seat-1')

    const none = pickBestSeat({
      ...base,
      seats: SEATS.filter((seat) => seat.id !== 'seat-2'),
      startTime: '10:00',
      endTime: '11:00'
    })
    expect(none).toBeNull()
  })
})

describe('容量与使用率统计', () => {
  it('countAvailableSeats 汇总总数、空闲数与占用数', () => {
    const result = countAvailableSeats({
      room: ROOMS[0],
      date: '2026-11-04',
      startTime: '09:00',
      endTime: '10:00',
      seats: SEATS,
      reservations: RESERVATIONS
    })
    expect(result).toEqual({ total: 2, available: 1, occupied: 1 })
  })

  it('seatSlotUsage 按 30 分钟切片统计使用率', () => {
    const result = seatSlotUsage({
      room: ROOMS[0],
      date: '2026-11-04',
      startTime: '09:00',
      endTime: '11:00',
      seats: SEATS,
      reservations: RESERVATIONS
    })
    expect(result).toEqual({ totalSlots: 8, usedSlots: 4, rate: 50 })
  })

  it('seatSlotUsage 对空座位或无时段返回 0', () => {
    expect(
      seatSlotUsage({ room: ROOMS[1], date: '2026-11-04', startTime: '09:00', endTime: '11:00', seats: [], reservations: RESERVATIONS })
    ).toEqual({ totalSlots: 0, usedSlots: 0, rate: 0 })
    expect(
      seatSlotUsage({ room: ROOMS[0], date: '2026-11-04', startTime: '11:00', endTime: '11:00', seats: SEATS, reservations: RESERVATIONS })
    ).toEqual({ totalSlots: 0, usedSlots: 0, rate: 0 })
  })

  it('dailyOccupancyRate 按开放分钟数计算占用率', () => {
    const result = dailyOccupancyRate({
      rooms: ROOMS,
      seats: SEATS,
      reservations: RESERVATIONS,
      date: '2026-11-04'
    })
    expect(result.totalMinutes).toBe(1680)
    expect(result.busyMinutes).toBe(120)
    expect(result.rate).toBe(7)
  })

  it('dailyOccupancyRate 无数据时返回 0 不产生除零', () => {
    const result = dailyOccupancyRate({ rooms: [], seats: [], reservations: [], date: '2026-11-04' })
    expect(result).toEqual({ totalMinutes: 0, busyMinutes: 0, rate: 0 })
  })

  it('todayAvailabilitySummary 只统计开放房间和当日有效预约', () => {
    const summary = todayAvailabilitySummary({
      rooms: ROOMS,
      seats: SEATS,
      reservations: RESERVATIONS.filter((item) => item.id !== 'r2'),
      now: new Date(2026, 10, 4, 12, 0, 0)
    })
    expect(summary).toHaveLength(1)
    expect(summary[0]).toEqual({
      roomId: 'room-1',
      roomName: '静思苑 A101',
      total: 2,
      activeReservations: 1
    })
  })
})