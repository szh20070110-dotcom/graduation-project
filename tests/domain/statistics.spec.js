import { describe, expect, it } from 'vitest'
import {
  buildOverview,
  countByStatus,
  hourlyHeatmap,
  occupancyByRoom,
  roomSeatStatus
} from '../../src/domain/statistics.js'
import { RESERVATION_STATUS } from '../../src/domain/conflict.js'

const TODAY = new Date(2026, 10, 4, 12, 0, 0)

const RESERVATIONS = [
  { id: 'r1', userId: 'u1', seatId: 'seat-1', date: '2026-11-04', startTime: '09:00', endTime: '10:30', status: RESERVATION_STATUS.RESERVED },
  { id: 'r2', userId: 'u2', seatId: 'seat-2', date: '2026-11-04', startTime: '10:00', endTime: '12:00', status: RESERVATION_STATUS.CHECKED_IN },
  { id: 'r3', userId: 'u3', seatId: 'seat-1', date: '2026-11-03', startTime: '14:00', endTime: '16:00', status: RESERVATION_STATUS.COMPLETED },
  { id: 'r4', userId: 'u1', seatId: 'seat-2', date: '2026-11-04', startTime: '18:00', endTime: '20:00', status: RESERVATION_STATUS.CANCELLED },
  { id: 'r5', userId: 'u4', seatId: 'seat-1', date: '2026-11-04', startTime: '08:00', endTime: '09:00', status: RESERVATION_STATUS.NO_SHOW },
  { id: 'r6', userId: 'u5', seatId: 'seat-2', date: '2026-11-04', startTime: '09:00', endTime: '10:00', status: 'unknown_status' }
]

const ROOMS = [
  { id: 'room-1', name: '静思苑 A101', building: '静思苑', openTime: '08:00', closeTime: '22:00', status: 'open' },
  { id: 'room-2', name: '图书馆 B201', building: '图书馆', openTime: '08:00', closeTime: '22:00', status: 'closed' }
]

const SEATS = [
  { id: 'seat-1', roomId: 'room-1', code: 'A-01', status: 'available' },
  { id: 'seat-2', roomId: 'room-1', code: 'A-02', status: 'available' },
  { id: 'seat-3', roomId: 'room-1', code: 'A-03', status: 'disabled' },
  { id: 'seat-4', roomId: 'room-2', code: 'B-01', status: 'available' }
]

describe('状态计数', () => {
  it('按状态累计数量，总数包含全部记录', () => {
    const counts = countByStatus(RESERVATIONS)
    expect(counts).toEqual({
      total: 6,
      reserved: 1,
      checked_in: 1,
      completed: 1,
      cancelled: 1,
      no_show: 1
    })
  })

  it('未知状态不计入任何分项但计入总数', () => {
    const counts = countByStatus([{ status: 'unknown_status' }])
    expect(counts.total).toBe(1)
    expect(counts.reserved).toBe(0)
  })

  it('空数组返回全 0', () => {
    expect(countByStatus().total).toBe(0)
  })
})

describe('运营概览', () => {
  it('计算当日预约、签到率与爽约率', () => {
    const users = [
      { id: 'u1', noShowCount: 1, bannedUntil: '2026-11-06T00:00:00.000Z' },
      { id: 'u2', noShowCount: 0, bannedUntil: null }
    ]
    const overview = buildOverview(RESERVATIONS, users, TODAY)
    expect(overview.total).toBe(6)
    expect(overview.today).toBe(5)
    expect(overview.active).toBe(2)
    expect(overview.checkedIn).toBe(2)
    expect(overview.noShow).toBe(1)
    expect(overview.cancelled).toBe(1)
    expect(overview.completed).toBe(1)
    expect(overview.checkInRate).toBe(67)
    expect(overview.noShowRate).toBe(33)
    expect(overview.bannedUsers).toBe(1)
    expect(overview.atRiskUsers).toBe(1)
  })

  it('有效预约为 0 时比率返回 0，避免除零', () => {
    const overview = buildOverview([{ status: RESERVATION_STATUS.CANCELLED }], [], TODAY)
    expect(overview.checkInRate).toBe(0)
    expect(overview.noShowRate).toBe(0)
  })
})

describe('自习室使用率', () => {
  it('按座位开放容量计算使用率，并忽略关闭房间', () => {
    const result = occupancyByRoom({ rooms: ROOMS, seats: SEATS, reservations: RESERVATIONS, date: '2026-11-04' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('room-1')
    expect(result[0].seatCount).toBe(2)
    expect(result[0].capacityMinutes).toBe(1680)
    expect(result[0].bookedMinutes).toBe(270)
    expect(result[0].rate).toBe(16)
  })

  it('取消与爽约记录不占用容量', () => {
    const result = occupancyByRoom({
      rooms: [ROOMS[0]],
      seats: SEATS,
      reservations: [
        { ...RESERVATIONS[0], status: RESERVATION_STATUS.CANCELLED },
        { ...RESERVATIONS[1], status: RESERVATION_STATUS.NO_SHOW }
      ],
      date: '2026-11-04'
    })
    expect(result[0].bookedMinutes).toBe(0)
    expect(result[0].rate).toBe(0)
  })

  it('容量为 0 时使用率返回 0', () => {
    const result = occupancyByRoom({
      rooms: [{ ...ROOMS[0], openTime: '10:00', closeTime: '10:00' }],
      seats: SEATS,
      reservations: RESERVATIONS,
      date: '2026-11-04'
    })
    expect(result[0].capacityMinutes).toBe(0)
    expect(result[0].rate).toBe(0)
  })
})

describe('时段热度', () => {
  it('按整点累计有效预约，覆盖 08:00-21:00', () => {
    const heatmap = hourlyHeatmap(RESERVATIONS, '2026-11-04')
    expect(heatmap).toHaveLength(14)
    expect(heatmap[0].hour).toBe('08:00')
    expect(heatmap.at(-1).hour).toBe('21:00')
    const byHour = Object.fromEntries(heatmap.map((slot) => [slot.hour, slot.count]))
    expect(byHour['08:00']).toBe(0)
    expect(byHour['09:00']).toBe(2)
    expect(byHour['10:00']).toBe(1)
    expect(byHour['11:00']).toBe(1)
    expect(byHour['18:00']).toBe(0)
  })

  it('跨日、取消与爽约记录不计入热度', () => {
    const heatmap = hourlyHeatmap(
      [
        { date: '2026-11-05', startTime: '09:00', endTime: '10:00', status: RESERVATION_STATUS.RESERVED },
        { date: '2026-11-04', startTime: '09:00', endTime: '10:00', status: RESERVATION_STATUS.CANCELLED },
        { date: '2026-11-04', startTime: '09:00', endTime: '10:00', status: RESERVATION_STATUS.NO_SHOW }
      ],
      '2026-11-04'
    )
    expect(heatmap.every((slot) => slot.count === 0)).toBe(true)
  })

  it('开放时间之外的预约不会创建新的小时分组', () => {
    const heatmap = hourlyHeatmap(
      [{ date: '2026-11-04', startTime: '07:00', endTime: '08:00', status: RESERVATION_STATUS.RESERVED }],
      '2026-11-04'
    )
    expect(heatmap).toHaveLength(14)
    expect(heatmap[0].count).toBe(0)
  })
})

describe('座位状态视图', () => {
  it('为每个座位统计当日活跃预约数', () => {
    const status = roomSeatStatus({ room: ROOMS[0], seats: SEATS, reservations: RESERVATIONS, date: '2026-11-04' })
    expect(status).toHaveLength(3)
    expect(status.find((seat) => seat.id === 'seat-1').activeCount).toBe(1)
    expect(status.find((seat) => seat.id === 'seat-2').activeCount).toBe(1)
    expect(status.find((seat) => seat.id === 'seat-3').activeCount).toBe(0)
  })
})