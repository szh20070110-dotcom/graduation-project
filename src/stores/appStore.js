import { computed, reactive, watch } from 'vue'
import { createSeedData, SESSION_KEY, SEED_VERSION, STORAGE_KEY } from '../data/seed.js'
import { applyCheckIn, applyNoShow, liftBan } from '../domain/credit.js'
import { canCheckIn, canCancel, getNoShowCandidates, validateReservation } from '../domain/reservation.js'
import { RESERVATION_STATUS } from '../domain/conflict.js'

function safeParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function loadState() {
  if (typeof localStorage !== 'undefined') {
    const saved = safeParse(localStorage.getItem(STORAGE_KEY))
    if (saved && saved.version === SEED_VERSION && Array.isArray(saved.users) && Array.isArray(saved.seats)) {
      return saved
    }
  }
  return createSeedData()
}

function loadSession() {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(SESSION_KEY)
}

export const store = reactive(loadState())
export const session = reactive({ userId: loadSession() })

export const currentUser = computed(
  () => store.users.find((user) => user.id === session.userId) || null
)

export const isAdmin = computed(() => currentUser.value?.role === 'admin')
export const isStudent = computed(() => currentUser.value?.role === 'student')

function persistState() {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

watch(store, persistState, { deep: true })
watch(
  () => session.userId,
  (value) => {
    if (typeof localStorage === 'undefined') return
    if (value) localStorage.setItem(SESSION_KEY, value)
    else localStorage.removeItem(SESSION_KEY)
  }
)

export function login(account, password, role) {
  const user = store.users.find((item) => item.account === account && item.role === role)
  if (!user) return { ok: false, message: '账号不存在，或角色选择有误' }
  if (user.password !== password) return { ok: false, message: '密码不正确' }
  session.userId = user.id
  return { ok: true, user }
}

export function logout() {
  session.userId = null
}

export function getRoomById(id) {
  return store.rooms.find((room) => room.id === id) || null
}

export function getSeatById(id) {
  return store.seats.find((seat) => seat.id === id) || null
}

export function getUserById(id) {
  return store.users.find((user) => user.id === id) || null
}

export function createReservation(payload, now = new Date()) {
  const user = currentUser.value
  if (!user) return { ok: false, errors: ['请先登录'] }
  if (user.role !== 'student') return { ok: false, errors: ['仅学生账号可发起预约'] }

  const seat = getSeatById(payload.seatId)
  const room = seat ? getRoomById(seat.roomId) : null
  if (!seat || !room) return { ok: false, errors: ['所选座位不存在'] }

  const candidate = {
    userId: user.id,
    seatId: seat.id,
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime
  }
  const result = validateReservation(candidate, {
    seat,
    room,
    user,
    reservations: store.reservations,
    now
  })
  if (!result.ok) return { ok: false, errors: result.errors }

  const reservation = {
    id: `r-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    ...candidate,
    roomId: room.id,
    status: RESERVATION_STATUS.RESERVED,
    note: payload.note?.trim() || '',
    createdAt: now.toISOString()
  }
  store.reservations.push(reservation)
  return { ok: true, reservation }
}

export function cancelReservation(id, now = new Date()) {
  const reservation = store.reservations.find((item) => item.id === id)
  if (!reservation) return { ok: false, message: '预约记录不存在' }
  const user = currentUser.value
  if (!user || (reservation.userId !== user.id && user.role !== 'admin')) {
    return { ok: false, message: '无权操作该预约' }
  }
  if (!canCancel(reservation, now)) {
    return { ok: false, message: '仅可在开始前 30 分钟取消待签到预约' }
  }
  reservation.status = RESERVATION_STATUS.CANCELLED
  reservation.cancelledAt = now.toISOString()
  return { ok: true, message: '预约已取消，信用分不受影响' }
}

export function checkInReservation(id, now = new Date()) {
  const reservation = store.reservations.find((item) => item.id === id)
  if (!reservation) return { ok: false, message: '预约记录不存在' }
  const user = currentUser.value
  if (!user || reservation.userId !== user.id) return { ok: false, message: '无权操作该预约' }
  if (!canCheckIn(reservation, now)) {
    return { ok: false, message: `签到窗口为开始前 ${15} 分钟至开始后 15 分钟` }
  }
  reservation.status = RESERVATION_STATUS.CHECKED_IN
  reservation.checkedInAt = now.toISOString()
  Object.assign(user, applyCheckIn(user))
  return { ok: true, message: '签到成功，信用分 +2' }
}

export function sweepNoShows(now = new Date()) {
  const candidates = getNoShowCandidates(store.reservations, now)
  for (const reservation of candidates) {
    reservation.status = RESERVATION_STATUS.NO_SHOW
    reservation.noShowAt = now.toISOString()
    const user = getUserById(reservation.userId)
    if (user) Object.assign(user, applyNoShow(user, now))
  }
  return { ok: true, count: candidates.length }
}

export function markNoShow(id, now = new Date()) {
  const reservation = store.reservations.find((item) => item.id === id)
  if (!reservation) return { ok: false, message: '预约记录不存在' }
  if (reservation.status !== RESERVATION_STATUS.RESERVED) {
    return { ok: false, message: '仅待签到预约可标记爽约' }
  }
  reservation.status = RESERVATION_STATUS.NO_SHOW
  reservation.noShowAt = now.toISOString()
  const user = getUserById(reservation.userId)
  if (user) Object.assign(user, applyNoShow(user, now))
  return { ok: true, message: '已标记爽约并更新信用分' }
}

export function settleReservations(now = new Date()) {
  let count = 0
  for (const reservation of store.reservations) {
    if (reservation.status === RESERVATION_STATUS.CHECKED_IN) {
      const end = new Date(`${reservation.date}T${reservation.endTime}:00`)
      if (now.getTime() > end.getTime()) {
        reservation.status = RESERVATION_STATUS.COMPLETED
        reservation.completedAt = now.toISOString()
        count += 1
      }
    }
  }
  return count
}

export function liftUserBan(userId) {
  const user = getUserById(userId)
  if (!user) return { ok: false, message: '用户不存在' }
  Object.assign(user, liftBan(user))
  return { ok: true, message: `已解除 ${user.name} 的预约限制` }
}

export function toggleRoomStatus(roomId) {
  const room = getRoomById(roomId)
  if (!room) return { ok: false, message: '自习室不存在' }
  room.status = room.status === 'open' ? 'closed' : 'open'
  return { ok: true, message: room.status === 'open' ? '自习室已开放' : '自习室已关闭' }
}

export function resetDemoData() {
  const fresh = createSeedData()
  Object.assign(store, fresh)
  session.userId = null
  return { ok: true }
}