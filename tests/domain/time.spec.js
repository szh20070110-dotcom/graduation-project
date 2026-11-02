import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMinutesToTime,
  buildSlots,
  durationMinutes,
  formatDateLabel,
  isAlignedToSlot,
  isValidTime,
  isWithinRange,
  minutesToTime,
  parseDateKey,
  rangesOverlap,
  splitRange,
  timeToMinutes,
  toDateKey,
  toDateTime,
  weekdayLabel
} from '../../src/domain/time.js'

describe('时间基础换算', () => {
  it('timeToMinutes 将 HH:mm 转为当日分钟数', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('08:30')).toBe(510)
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('timeToMinutes 对非法格式与越界值返回 NaN', () => {
    expect(timeToMinutes('8:00')).toBeNaN()
    expect(timeToMinutes('24:00')).toBeNaN()
    expect(timeToMinutes('12:60')).toBeNaN()
    expect(timeToMinutes('12-00')).toBeNaN()
    expect(timeToMinutes(null)).toBeNaN()
    expect(timeToMinutes(930)).toBeNaN()
  })

  it('minutesToTime 还原时间并处理边界', () => {
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(510)).toBe('08:30')
    expect(minutesToTime(1439)).toBe('23:59')
    expect(minutesToTime(1440)).toBe('23:59')
    expect(minutesToTime(-10)).toBe('')
    expect(minutesToTime(Number.NaN)).toBe('')
  })

  it('isValidTime 仅接受合法 HH:mm', () => {
    expect(isValidTime('09:00')).toBe(true)
    expect(isValidTime('9:00')).toBe(false)
    expect(isValidTime('')).toBe(false)
  })

  it('durationMinutes 计算时长，非法输入得到 NaN', () => {
    expect(durationMinutes('09:00', '11:30')).toBe(150)
    expect(durationMinutes('09:00', '09:00')).toBe(0)
    expect(durationMinutes('bad', '10:00')).toBeNaN()
  })

  it('addMinutesToTime 支持跨小时并拒绝非法输入', () => {
    expect(addMinutesToTime('08:00', 120)).toBe('10:00')
    expect(addMinutesToTime('23:30', 60)).toBe('23:59')
    expect(addMinutesToTime('bad', 30)).toBe('')
  })
})

describe('区间关系判断', () => {
  it('rangesOverlap 识别真实重叠', () => {
    expect(rangesOverlap('09:00', '11:00', '10:00', '12:00')).toBe(true)
    expect(rangesOverlap('09:00', '11:00', '09:30', '10:30')).toBe(true)
  })

  it('rangesOverlap 认为首尾相接不算重叠（左闭右开语义）', () => {
    expect(rangesOverlap('09:00', '10:00', '10:00', '11:00')).toBe(false)
    expect(rangesOverlap('10:00', '11:00', '09:00', '10:00')).toBe(false)
  })

  it('rangesOverlap 支持分钟数入参，非法入参返回 false', () => {
    expect(rangesOverlap(540, 660, 600, 720)).toBe(true)
    expect(rangesOverlap('bad', '10:00', '09:00', '11:00')).toBe(false)
  })

  it('isAlignedToSlot 校验 30 分钟对齐', () => {
    expect(isAlignedToSlot('09:00')).toBe(true)
    expect(isAlignedToSlot('09:30')).toBe(true)
    expect(isAlignedToSlot('09:15')).toBe(false)
    expect(isAlignedToSlot('09:10')).toBe(false)
    expect(isAlignedToSlot('bad')).toBe(false)
  })

  it('isWithinRange 要求完全落在开放区间内', () => {
    expect(isWithinRange('08:00', '22:00', '08:00', '22:00')).toBe(true)
    expect(isWithinRange('07:30', '09:00', '08:00', '22:00')).toBe(false)
    expect(isWithinRange('21:00', '22:30', '08:00', '22:00')).toBe(false)
    expect(isWithinRange('10:00', '10:00', '08:00', '22:00')).toBe(false)
    expect(isWithinRange('bad', '10:00', '08:00', '22:00')).toBe(false)
  })
})

describe('时间段切分', () => {
  it('splitRange 按 30 分钟切分并生成标签', () => {
    const slots = splitRange('09:00', '10:30')
    expect(slots).toHaveLength(3)
    expect(slots[0]).toEqual({ start: '09:00', end: '09:30', label: '09:00-09:30' })
    expect(slots[2]).toEqual({ start: '10:00', end: '10:30', label: '10:00-10:30' })
  })

  it('splitRange 丢弃不足一个步长的尾部区间', () => {
    expect(splitRange('09:00', '09:45')).toHaveLength(1)
    expect(splitRange('09:00', '09:29')).toEqual([])
    expect(splitRange('09:00', '09:30', 15)).toHaveLength(2)
  })

  it('splitRange 对非法输入与反向区间返回空数组', () => {
    expect(splitRange('bad', '10:00')).toEqual([])
    expect(splitRange('10:00', '09:00')).toEqual([])
    expect(splitRange('09:00', '10:00', 0)).toEqual([])
    expect(splitRange('09:00', '09:00')).toEqual([])
  })

  it('buildSlots 等于按开放时间的 splitRange', () => {
    const slots = buildSlots('08:00', '09:00')
    expect(slots).toHaveLength(2)
    expect(slots.map((slot) => slot.label)).toEqual(['08:00-08:30', '08:30-09:00'])
    expect(buildSlots('08:00', '09:00', 20)).toHaveLength(3)
  })
})

describe('日期工具', () => {
  it('toDateKey 输出补零的 yyyy-mm-dd', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateKey(new Date(2026, 10, 3))).toBe('2026-11-03')
  })

  it('parseDateKey 拒绝格式错误与不存在的日期', () => {
    expect(toDateKey(parseDateKey('2026-11-03'))).toBe('2026-11-03')
    expect(parseDateKey('2026-13-01')).toBeNull()
    expect(parseDateKey('2026-02-30')).toBeNull()
    expect(parseDateKey('2026/11/03')).toBeNull()
    expect(parseDateKey(null)).toBeNull()
  })

  it('toDateTime 组合日期时间，非法输入返回 null', () => {
    const date = toDateTime('2026-11-03', '09:30')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(10)
    expect(date.getDate()).toBe(3)
    expect(date.getHours()).toBe(9)
    expect(date.getMinutes()).toBe(30)
    expect(toDateTime('bad', '09:30')).toBeNull()
    expect(toDateTime('2026-11-03', '25:00')).toBeNull()
  })

  it('addDays 正确处理跨月与非法日期', () => {
    expect(addDays('2026-11-03', 1)).toBe('2026-11-04')
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('bad', 1)).toBe('')
  })

  it('weekdayLabel 与 formatDateLabel 输出中文标签', () => {
    expect(weekdayLabel('2026-11-03')).toBe('周二')
    expect(weekdayLabel('bad')).toBe('')
    expect(formatDateLabel('2026-11-03')).toBe('11月3日')
    expect(formatDateLabel('bad')).toBe('bad')
  })
})