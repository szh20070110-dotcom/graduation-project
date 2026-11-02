<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { store, createReservation, currentUser } from '../stores/appStore.js'
import { countAvailableSeats, listAvailableSeats, pickBestSeat, recommendSeats } from '../domain/allocation.js'
import {
  addDays,
  addMinutesToTime,
  durationMinutes,
  formatDateLabel,
  splitRange,
  toDateKey,
  weekdayLabel
} from '../domain/time.js'

const router = useRouter()
const today = toDateKey(new Date())
const dates = Array.from({ length: 7 }, (_, index) => addDays(today, index))
const rooms = computed(() => store.rooms)
const selectedRoomId = ref(store.rooms[0]?.id || '')
const selectedDate = ref(dates[0])
const room = computed(() => store.rooms.find((item) => item.id === selectedRoomId.value) || null)
const startTime = ref(room.value?.openTime || '08:00')
const endTime = ref(addMinutesToTime(startTime.value, 120))
const selectedSeatId = ref('')
const preference = ref({ socket: false, window: false, quiet: false })
const note = ref('')
const feedback = ref(null)
const success = ref(null)
let feedbackTimer = null

const startOptions = computed(() => {
  if (!room.value) return []
  return splitRange(room.value.openTime, room.value.closeTime).map((slot) => slot.start)
})

const endOptions = computed(() => {
  if (!room.value) return []
  return splitRange(room.value.openTime, room.value.closeTime)
    .map((slot) => slot.end)
    .filter((value) => {
      const duration = durationMinutes(startTime.value, value)
      return duration > 0 && duration <= 240
    })
})

const roomSeats = computed(() => store.seats.filter((seat) => seat.roomId === selectedRoomId.value))

const availability = computed(() => {
  if (!room.value) return { total: 0, available: 0, occupied: 0 }
  return countAvailableSeats({
    room: room.value,
    date: selectedDate.value,
    startTime: startTime.value,
    endTime: endTime.value,
    seats: store.seats,
    reservations: store.reservations
  })
})

const availableSeats = computed(() => {
  if (!room.value) return []
  return listAvailableSeats({
    roomId: selectedRoomId.value,
    date: selectedDate.value,
    startTime: startTime.value,
    endTime: endTime.value,
    seats: store.seats,
    reservations: store.reservations
  })
})

const availableIds = computed(() => new Set(availableSeats.value.map((seat) => seat.id)))

const recommended = computed(() => {
  if (!room.value) return []
  return recommendSeats({
    roomId: selectedRoomId.value,
    date: selectedDate.value,
    startTime: startTime.value,
    endTime: endTime.value,
    seats: store.seats,
    reservations: store.reservations,
    preference: preference.value,
    limit: 3
  })
})

const recommendedIds = computed(() => new Set(recommended.value.map((seat) => seat.id)))
const selectedSeat = computed(() => roomSeats.value.find((seat) => seat.id === selectedSeatId.value) || null)
const duration = computed(() => Math.max(durationMinutes(startTime.value, endTime.value), 0))
const closed = computed(() => room.value?.status === 'closed')
const creditHint = computed(() => {
  if (!currentUser.value) return ''
  if (currentUser.value.bannedUntil) return '你正在禁约期，暂不能预约'
  return `当前信用分 ${currentUser.value.creditScore}，按时签到可 +2 分`
})

watch(selectedRoomId, () => {
  if (!room.value) return
  startTime.value = room.value.openTime
  endTime.value = addMinutesToTime(startTime.value, Math.min(120, durationMinutes(room.value.openTime, room.value.closeTime)))
  selectedSeatId.value = ''
})

watch([selectedDate, startTime, endTime], () => {
  if (selectedSeatId.value && !availableIds.value.has(selectedSeatId.value)) {
    selectedSeatId.value = ''
    showFeedback('所选时段变化后原座位不可用，请重新选择', 'warning')
  }
  success.value = null
})

watch(endOptions, (options) => {
  if (options.length && !options.includes(endTime.value)) {
    endTime.value = options[0]
  }
})

function showFeedback(text, tone = 'danger') {
  feedback.value = { text, tone }
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    feedback.value = null
  }, 4000)
}

function togglePreference(key) {
  preference.value[key] = !preference.value[key]
}

function useRecommendation() {
  const best = pickBestSeat({
    roomId: selectedRoomId.value,
    date: selectedDate.value,
    startTime: startTime.value,
    endTime: endTime.value,
    seats: store.seats,
    reservations: store.reservations,
    preference: preference.value
  })
  if (!best) {
    showFeedback('该时段已没有可预约座位', 'warning')
    return
  }
  selectedSeatId.value = best.id
  showFeedback(`已根据偏好推荐座位 ${best.code}`, 'success')
}

function chooseSeat(seat) {
  if (!availableIds.value.has(seat.id)) return
  selectedSeatId.value = seat.id
}

function submit() {
  success.value = null
  if (!selectedSeat.value) {
    showFeedback('请先在座位图中选择一个空闲座位', 'warning')
    return
  }
  const result = createReservation({
    seatId: selectedSeat.value.id,
    date: selectedDate.value,
    startTime: startTime.value,
    endTime: endTime.value,
    note: note.value
  })
  if (!result.ok) {
    showFeedback(result.errors[0], 'danger')
    return
  }
  success.value = {
    message: `预约成功：${formatDateLabel(selectedDate.value)} ${startTime.value}-${endTime.value}，座位 ${selectedSeat.value.code}`,
    id: result.reservation.id
  }
  selectedSeatId.value = ''
  note.value = ''
}

onUnmounted(() => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<template>
  <div class="student-home">
    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>1. 选择自习室</h2>
          <p>共 {{ rooms.length }} 个自习室，开放状态与开放时间实时展示。</p>
        </div>
        <span class="badge badge-info">{{ selectedDate }} · {{ weekdayLabel(selectedDate) }}</span>
      </div>
      <div class="room-grid">
        <button
          v-for="item in rooms"
          :key="item.id"
          type="button"
          :class="['room-card', { active: item.id === selectedRoomId, closed: item.status === 'closed' }]"
          @click="selectedRoomId = item.id"
        >
          <div class="room-card-head">
            <strong>{{ item.name }}</strong>
            <span :class="['badge', item.status === 'closed' ? 'badge-muted' : 'badge-success']">
              {{ item.status === 'closed' ? '暂停开放' : '开放中' }}
            </span>
          </div>
          <p>{{ item.description }}</p>
          <div class="room-meta">
            <span>{{ item.building }} {{ item.floor }} 层</span>
            <span>{{ item.openTime }}-{{ item.closeTime }}</span>
            <span>{{ store.seats.filter((seat) => seat.roomId === item.id).length }} 座</span>
          </div>
          <div class="tag-row">
            <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </button>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>2. 选择日期与时段</h2>
          <p>以 30 分钟为最小粒度，单次预约 30 分钟至 4 小时，最多提前 7 天。</p>
        </div>
      </div>
      <div class="date-strip">
        <button
          v-for="date in dates"
          :key="date"
          type="button"
          :class="['date-chip', { active: date === selectedDate }]"
          @click="selectedDate = date"
        >
          <span>{{ weekdayLabel(date) }}</span>
          <strong>{{ formatDateLabel(date) }}</strong>
          <small>{{ date === today ? '今天' : date === addDays(today, 1) ? '示例数据' : '可预约' }}</small>
        </button>
      </div>

      <div class="filter-row">
        <label class="field field-inline">
          <span>开始时间</span>
          <select v-model="startTime" :disabled="closed">
            <option v-for="time in startOptions" :key="time" :value="time">{{ time }}</option>
          </select>
        </label>
        <label class="field field-inline">
          <span>结束时间</span>
          <select v-model="endTime" :disabled="closed">
            <option v-for="time in endOptions" :key="time" :value="time">{{ time }}</option>
          </select>
        </label>
        <div class="preference-box">
          <span class="pref-label">座位偏好</span>
          <button type="button" :class="['toggle-chip', { active: preference.socket }]" @click="togglePreference('socket')">
            有插座
          </button>
          <button type="button" :class="['toggle-chip', { active: preference.window }]" @click="togglePreference('window')">
            靠窗
          </button>
          <button type="button" :class="['toggle-chip', { active: preference.quiet }]" @click="togglePreference('quiet')">
            安静区
          </button>
          <button type="button" class="btn btn-secondary btn-sm" :disabled="closed" @click="useRecommendation">
            智能推荐座位
          </button>
        </div>
      </div>

      <div class="availability-line">
        <div>
          <span class="pulse-dot"></span>
          <strong>{{ room?.name }}</strong>
          <span class="muted">{{ selectedDate }} {{ startTime }}-{{ endTime }}（{{ duration }} 分钟）</span>
        </div>
        <div class="availability-count">
          空闲 <strong>{{ availability.available }}</strong> / {{ availability.total }} 座
        </div>
      </div>
    </section>

    <div v-if="closed" class="alert alert-warning">该自习室当前暂停开放，请选择其他自习室。</div>
    <div v-if="feedback" :class="['alert', `alert-${feedback.tone}`]">{{ feedback.text }}</div>
    <div v-if="success" class="alert alert-success">
      <span>{{ success.message }}</span>
      <button class="link-button" type="button" @click="router.push('/student/reservations')">查看我的预约</button>
    </div>

    <section class="seat-layout">
      <div class="card section-card">
        <div class="section-title">
          <div>
            <h2>3. 选择座位</h2>
            <p>灰色座位在该时段已被占用，蓝框为系统推荐，绿色为当前选择。</p>
          </div>
          <span class="badge badge-info">{{ roomSeats.length }} 个座位</span>
        </div>

        <div class="seat-legend">
          <span><i class="legend-dot available"></i>空闲</span>
          <span><i class="legend-dot occupied"></i>已占用</span>
          <span><i class="legend-dot selected"></i>已选择</span>
          <span><i class="legend-dot recommended"></i>推荐</span>
          <span class="legend-divider"></span>
          <span>窗 = 靠窗 · 电 = 有插座</span>
        </div>

        <div class="seat-grid">
          <button
            v-for="seat in roomSeats"
            :key="seat.id"
            type="button"
            :disabled="!availableIds.has(seat.id) || closed"
            :class="[
              'seat',
              {
                occupied: !availableIds.has(seat.id),
                selected: seat.id === selectedSeatId,
                recommended: recommendedIds.has(seat.id) && seat.id !== selectedSeatId
              }
            ]"
            @click="chooseSeat(seat)"
          >
            <span class="seat-code">{{ seat.code }}</span>
            <span class="seat-tags">
              <i v-if="seat.isWindow">窗</i>
              <i v-if="seat.hasSocket">电</i>
            </span>
            <small>{{ availableIds.has(seat.id) ? '空闲' : '占用' }}</small>
          </button>
        </div>
      </div>

      <aside class="card summary-card">
        <h2>预约确认</h2>
        <p class="summary-sub">请核对预约信息，提交后将占用该座位时段。</p>
        <dl class="summary-list">
          <div><dt>自习室</dt><dd>{{ room?.name || '—' }}</dd></div>
          <div><dt>日期</dt><dd>{{ selectedDate }} {{ weekdayLabel(selectedDate) }}</dd></div>
          <div><dt>时段</dt><dd>{{ startTime }} - {{ endTime }}</dd></div>
          <div><dt>时长</dt><dd>{{ duration }} 分钟</dd></div>
          <div><dt>座位</dt><dd>{{ selectedSeat?.code || '尚未选择' }}</dd></div>
          <div>
            <dt>座位属性</dt>
            <dd>
              <template v-if="selectedSeat">
                {{ selectedSeat.isWindow ? '靠窗 ' : '' }}{{ selectedSeat.hasSocket ? '有插座 ' : '' }}{{ selectedSeat.zone === 'quiet' ? '安静区' : '普通区' }}
              </template>
              <template v-else>—</template>
            </dd>
          </div>
        </dl>
        <label class="field">
          <span>备注（可选）</span>
          <input v-model="note" maxlength="30" placeholder="例如：考研数学复习" />
        </label>
        <p class="credit-hint">{{ creditHint }}</p>
        <button class="btn btn-primary btn-block" type="button" :disabled="!selectedSeat || closed" @click="submit">
          确认预约
        </button>
        <p class="fine-print">开始前 30 分钟可免费取消；开始后 15 分钟未签到将记为爽约。</p>
      </aside>
    </section>
  </div>
</template>