<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  cancelReservation,
  checkInReservation,
  currentUser,
  getRoomById,
  getSeatById,
  store,
  sweepNoShows
} from '../stores/appStore.js'
import { canCancel, canCheckIn } from '../domain/reservation.js'
import { banRemainingDays, getCreditLevel, isBanned } from '../domain/credit.js'
import { formatDateLabel, weekdayLabel } from '../domain/time.js'

const now = ref(new Date())
const message = ref(null)
let timer = null

const user = computed(() => currentUser.value)
const credit = computed(() => getCreditLevel(user.value?.creditScore ?? 100))
const banned = computed(() => isBanned(user.value, now.value))
const remainingDays = computed(() => banRemainingDays(user.value, now.value))
const creditDegree = computed(() => ((user.value?.creditScore ?? 0) / 100) * 360)

const myReservations = computed(() =>
  store.reservations
    .filter((item) => item.userId === user.value?.id)
    .slice()
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
)

const upcoming = computed(() =>
  myReservations.value.filter(
    (item) =>
      (item.status === 'reserved' || item.status === 'checked_in') &&
      new Date(`${item.date}T${item.endTime}:00`).getTime() > now.value.getTime()
  )
)

const history = computed(() =>
  myReservations.value
    .filter((item) => !upcoming.value.some((current) => current.id === item.id))
    .slice()
    .reverse()
)

const noShowList = computed(() => myReservations.value.filter((item) => item.status === 'no_show'))

const statusMeta = {
  reserved: { label: '待签到', tone: 'info' },
  checked_in: { label: '已签到', tone: 'success' },
  completed: { label: '已完成', tone: 'neutral' },
  cancelled: { label: '已取消', tone: 'muted' },
  no_show: { label: '爽约', tone: 'danger' }
}

function roomName(id) {
  return getRoomById(id)?.name || '未知自习室'
}

function seatCode(id) {
  return getSeatById(id)?.code || '未知座位'
}

function showMessage(text, tone = 'success') {
  message.value = { text, tone }
  setTimeout(() => {
    message.value = null
  }, 3500)
}

function handleCheckIn(item) {
  const result = checkInReservation(item.id, new Date())
  showMessage(result.message, result.ok ? 'success' : 'danger')
  now.value = new Date()
}

function handleCancel(item) {
  if (!window.confirm(`确认取消 ${item.date} ${item.startTime}-${item.endTime} 的预约吗？`)) return
  const result = cancelReservation(item.id, new Date())
  showMessage(result.message, result.ok ? 'success' : 'danger')
  now.value = new Date()
}

function refreshNoShow() {
  const result = sweepNoShows(new Date())
  now.value = new Date()
  showMessage(
    result.count > 0 ? `已判定 ${result.count} 条爽约记录并扣除信用分` : '暂无新的爽约记录',
    result.count > 0 ? 'warning' : 'success'
  )
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 30_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="my-reservations">
    <div v-if="message" :class="['alert', `alert-${message.tone}`]">{{ message.text }}</div>

    <section class="credit-layout">
      <div class="card credit-card">
        <div class="credit-ring" :style="{ background: `conic-gradient(var(--primary) ${creditDegree}deg, #e2e8f0 0deg)` }">
          <div class="credit-ring-inner">
            <strong>{{ user?.creditScore ?? 100 }}</strong>
            <span>信用分</span>
          </div>
        </div>
        <div class="credit-copy">
          <span :class="['badge', `badge-${credit.tone}`]">{{ credit.label }}</span>
          <h2>{{ user?.name }}，{{ banned ? '预约已受限' : '保持良好信用' }}</h2>
          <p>{{ credit.advice }}</p>
          <p v-if="banned" class="danger-text">禁约剩余 {{ remainingDays }} 天（{{ user?.banReason }}）</p>
          <div class="credit-stats">
            <div><strong>{{ user?.noShowCount ?? 0 }}</strong><span>累计爽约</span></div>
            <div><strong>{{ noShowList.length }}</strong><span>爽约记录</span></div>
            <div><strong>{{ myReservations.length }}</strong><span>预约总数</span></div>
          </div>
        </div>
      </div>

      <div class="card rules-card">
        <h2>信用规则</h2>
        <ul class="rule-list">
          <li><span class="rule-index">01</span>初始信用分 100，按时签到 +2，上限 100。</li>
          <li><span class="rule-index">02</span>每爽约 1 次扣 10 分，信用分低于 60 即触发禁约。</li>
          <li><span class="rule-index">03</span>累计爽约 3 次同样触发禁约。</li>
          <li><span class="rule-index">04</span>禁约期为 7 天，到期自动恢复；管理员可手动解除。</li>
        </ul>
        <button class="btn btn-secondary btn-block" type="button" @click="refreshNoShow">立即检测爽约记录</button>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>进行中的预约</h2>
          <p>签到窗口为开始前 15 分钟至开始后 15 分钟；开始前 30 分钟可取消。</p>
        </div>
        <span class="badge badge-info">{{ upcoming.length }} 条</span>
      </div>

      <div v-if="!upcoming.length" class="empty-state">
        <strong>暂无进行中的预约</strong>
        <p>前往“查找座位”选择自习室与时段，即可创建预约。</p>
      </div>

      <div v-else class="reservation-list">
        <article v-for="item in upcoming" :key="item.id" class="reservation-item">
          <div class="reservation-date">
            <strong>{{ formatDateLabel(item.date) }}</strong>
            <span>{{ weekdayLabel(item.date) }}</span>
          </div>
          <div class="reservation-main">
            <div class="reservation-title">
              <strong>{{ roomName(item.roomId) }}</strong>
              <span :class="['badge', `badge-${statusMeta[item.status].tone}`]">{{ statusMeta[item.status].label }}</span>
            </div>
            <p>{{ item.startTime }} - {{ item.endTime }} · 座位 {{ seatCode(item.seatId) }}</p>
            <p v-if="item.note" class="muted">备注：{{ item.note }}</p>
          </div>
          <div class="reservation-actions">
            <button
              class="btn btn-primary btn-sm"
              type="button"
              :disabled="!canCheckIn(item, now)"
              @click="handleCheckIn(item)"
            >
              签到
            </button>
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              :disabled="!canCancel(item, now)"
              @click="handleCancel(item)"
            >
              取消预约
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>历史预约</h2>
          <p>已取消、已完成与爽约记录均保留，便于信用追溯。</p>
        </div>
        <span class="badge badge-muted">{{ history.length }} 条</span>
      </div>
      <div v-if="!history.length" class="empty-state">
        <strong>暂无历史记录</strong>
        <p>完成首次预约后，这里会展示你的履约轨迹。</p>
      </div>
      <div v-else class="history-table">
        <div class="history-row history-head">
          <span>日期</span><span>自习室 / 座位</span><span>时段</span><span>状态</span>
        </div>
        <div v-for="item in history" :key="item.id" class="history-row">
          <span>{{ item.date }}</span>
          <span>{{ roomName(item.roomId) }} · {{ seatCode(item.seatId) }}</span>
          <span>{{ item.startTime }}-{{ item.endTime }}</span>
          <span><i :class="['badge', `badge-${statusMeta[item.status].tone}`]">{{ statusMeta[item.status].label }}</i></span>
        </div>
      </div>
    </section>
  </div>
</template>