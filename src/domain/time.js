export const SLOT_MINUTES = 30

export function timeToMinutes(time) {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    return Number.NaN
  }
  const [hour, minute] = time.split(':').map(Number)
  if (hour > 23 || minute > 59) return Number.NaN
  return hour * 60 + minute
}

export function minutesToTime(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return ''
  const safe = Math.min(Math.round(minutes), 24 * 60 - 1)
  const hour = Math.floor(safe / 60)
  const minute = safe % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function isValidTime(time) {
  return Number.isFinite(timeToMinutes(time))
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const as = typeof aStart === 'number' ? aStart : timeToMinutes(aStart)
  const ae = typeof aEnd === 'number' ? aEnd : timeToMinutes(aEnd)
  const bs = typeof bStart === 'number' ? bStart : timeToMinutes(bStart)
  const be = typeof bEnd === 'number' ? bEnd : timeToMinutes(bEnd)
  if ([as, ae, bs, be].some((value) => !Number.isFinite(value))) return false
  return as < be && bs < ae
}

export function isAlignedToSlot(time, step = SLOT_MINUTES) {
  const minutes = timeToMinutes(time)
  return Number.isFinite(minutes) && minutes % step === 0
}

export function isWithinRange(start, end, rangeStart, rangeEnd) {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  const rs = timeToMinutes(rangeStart)
  const re = timeToMinutes(rangeEnd)
  if ([s, e, rs, re].some((value) => !Number.isFinite(value))) return false
  return s >= rs && e <= re && s < e
}

export function durationMinutes(start, end) {
  return timeToMinutes(end) - timeToMinutes(start)
}

export function addMinutesToTime(time, delta) {
  const minutes = timeToMinutes(time)
  if (!Number.isFinite(minutes)) return ''
  return minutesToTime(minutes + delta)
}

export function splitRange(start, end, step = SLOT_MINUTES) {
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return []
  if (step <= 0 || startMinutes >= endMinutes) return []
  const slots = []
  for (let cursor = startMinutes; cursor + step <= endMinutes; cursor += step) {
    slots.push({
      start: minutesToTime(cursor),
      end: minutesToTime(cursor + step),
      label: `${minutesToTime(cursor)}-${minutesToTime(cursor + step)}`
    })
  }
  return slots
}

export function buildSlots(openTime, closeTime, step = SLOT_MINUTES) {
  return splitRange(openTime, closeTime, step)
}

export function toDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function toDateTime(dateKey, time) {
  const date = parseDateKey(dateKey)
  const minutes = timeToMinutes(time)
  if (!date || !Number.isFinite(minutes)) return null
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
}

export function addDays(dateKey, days) {
  const date = parseDateKey(dateKey)
  if (!date) return ''
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function weekdayLabel(dateKey) {
  const date = parseDateKey(dateKey)
  if (!date) return ''
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
}

export function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey)
  if (!date) return dateKey
  return `${date.getMonth() + 1}月${date.getDate()}日`
}