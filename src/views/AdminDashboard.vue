<script setup>
import { computed, ref } from 'vue'
import {
  currentUser,
  getRoomById,
  getSeatById,
  getUserById,
  liftUserBan,
  resetDemoData,
  store,
  sweepNoShows,
  toggleRoomStatus
} from '../stores/appStore.js'
import { buildOverview, hourlyHeatmap, occupancyByRoom } from '../domain/statistics.js'
import { banRemainingDays, getCreditLevel, isBanned } from '../domain/credit.js'
import { addDays, formatDateLabel, toDateKey, weekdayLabel } from '../domain/time.js'

const now = new Date()
const today = toDateKey(now)
const dates = [today, addDays(today, 1), addDays(today, 2)]
const activeDate = ref(dates[1])
const message = ref(null)

const overview = computed(() =>
  buildOverview(store.reservations, store.users, new Date(`${activeDate.value}T12:00:00`))
)
const roomStats = computed(() =>
  occupancyByRoom({
    rooms: store.rooms,
    seats: store.seats,
    reservations: store.reservations,
    date: activeDate.value
  })
)
const heatmap = computed(() => hourlyHeatmap(store.reservations, activeDate.value))
const maxHeat = computed(() => Math.max(...heatmap.value.map((item) => item.count), 1))
const recentReservations = computed(() =>
  store.reservations
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6)
)
const riskUsers = computed(() =>
  store.users
    .filter((user) => user.role === 'student' && (user.noShowCount > 0 || user.bannedUntil))
    .sort((a, b) => (a.creditScore ?? 100) - (b.creditScore ?? 100))
)

const statusMeta = {
  reserved: { label: '待签到', tone: 'info' },
  checked_in: { label: '已签到', tone: 'success' },
  completed: { label: '已完成', tone: 'neutral' },
  cancelled: { label: '已取消', tone: 'muted' },
  no_show: { label: '爽约', tone: 'danger' }
}

function showMessage(text, tone = 'success') {
  message.value = { text, tone }
  setTimeout(() => {
    message.value = null
  }, 3500)
}

function roomName(id) {
  return getRoomById(id)?.name || '未知'
}

function seatCode(id) {
  return getSeatById(id)?.code || '未知'
}

function studentName(id) {
  return getUserById(id)?.name || '未知学生'
}

function handleSweep() {
  const result = sweepNoShows(new Date())
  showMessage(
    result.count > 0 ? `已自动判定 ${result.count} 条爽约记录` : '当前没有新的爽约记录',
    result.count > 0 ? 'warning' : 'success'
  )
}

function handleLift(user) {
  if (!window.confirm(`确认解除 ${user.name} 的预约限制吗？`)) return
  const result = liftUserBan(user.id)
  showMessage(result.message, result.ok ? 'success' : 'danger')
}

function handleToggleRoom(room) {
  const result = toggleRoomStatus(room.id)
  showMessage(result.message, 'success')
}

function handleReset() {
  if (!window.confirm('确认重置全部演示数据并退出登录吗？该操作不可撤销。')) return
  resetDemoData()
  window.location.hash = '#/login'
  window.location.reload()
}

function creditTone(user) {
  if (isBanned(user, new Date())) return 'danger'
  return getCreditLevel(user.creditScore ?? 100).tone
}
</script>

<template>
  <div class="admin-dashboard">
    <div v-if="message" :class="['alert', `alert-${message.tone}`]">{{ message.text }}</div>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>运营概览</h2>
          <p>数据来自本地 localStorage，切换日期可查看示例预约（{{ dates[1] }}）的统计结果。</p>
        </div>
        <div class="button-row">
          <button class="btn btn-secondary btn-sm" type="button" @click="handleSweep">检测爽约</button>
          <button class="btn btn-danger-ghost btn-sm" type="button" @click="handleReset">重置演示数据</button>
        </div>
      </div>

      <div class="date-tabs">
        <button
          v-for="date in dates"
          :key="date"
          type="button"
          :class="['date-chip date-chip-sm', { active: date === activeDate }]"
          @click="activeDate = date"
        >
          <span>{{ weekdayLabel(date) }}</span>
          <strong>{{ formatDateLabel(date) }}</strong>
          <small>{{ date === today ? '今天' : date === dates[1] ? '示例数据' : '未来' }}</small>
        </button>
      </div>

      <div class="metric-grid">
        <article class="metric-card">
          <span>预约总量</span>
          <strong>{{ overview.total }}</strong>
          <small>全部历史记录</small>
        </article>
        <article class="metric-card">
          <span>所选日期预约</span>
          <strong>{{ overview.today }}</strong>
          <small>{{ activeDate }}</small>
        </article>
        <article class="metric-card">
          <span>签到率</span>
          <strong>{{ overview.checkInRate }}%</strong>
          <small>已签到 + 已完成 / 有效预约</small>
        </article>
        <article class="metric-card">
          <span>爽约率</span>
          <strong>{{ overview.noShowRate }}%</strong>
          <small>{{ overview.noShow }} 条爽约记录</small>
        </article>
        <article class="metric-card">
          <span>禁约学生</span>
          <strong>{{ overview.bannedUsers }}</strong>
          <small>{{ overview.atRiskUsers }} 人有爽约记录</small>
        </article>
        <article class="metric-card">
          <span>当前管理员</span>
          <strong>{{ currentUser?.name }}</strong>
          <small>教务处 · 运营角色</small>
        </article>
      </div>
    </section>

    <section class="analytics-layout">
      <div class="card section-card">
        <div class="section-title">
          <div>
            <h2>自习室使用率</h2>
            <p>按“已预约时长 / 开放容量”计算，反映 {{ activeDate }} 的座位资源消耗。</p>
          </div>
        </div>
        <div class="bar-list">
          <div v-for="room in roomStats" :key="room.id" class="bar-item">
            <div class="bar-head">
              <span>{{ room.name }}</span>
              <strong>{{ room.rate }}%</strong>
            </div>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: `${Math.min(room.rate, 100)}%` }"></div>
            </div>
            <small>{{ room.building }} · {{ room.seatCount }} 座 · 已预约 {{ room.bookedMinutes }} 分钟</small>
          </div>
        </div>
      </div>

      <div class="card section-card">
        <div class="section-title">
          <div>
            <h2>时段热度</h2>
            <p>按整点聚合有效预约数量，用于安排值班与开放时段。</p>
          </div>
        </div>
        <div class="heat-list">
          <div v-for="slot in heatmap" :key="slot.hour" class="heat-item">
            <span>{{ slot.hour }}</span>
            <div class="heat-track">
              <div class="heat-fill" :style="{ width: `${(slot.count / maxHeat) * 100}%` }"></div>
            </div>
            <strong>{{ slot.count }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>爽约与信用管理</h2>
          <p>信用分低于 60 或累计爽约 3 次将自动禁约 7 天，管理员可人工解除。</p>
        </div>
      </div>
      <div v-if="!riskUsers.length" class="empty-state">
        <strong>暂无违规学生</strong>
        <p>所有学生信用记录良好。</p>
      </div>
      <div v-else class="risk-list">
        <article v-for="user in riskUsers" :key="user.id" class="risk-item">
          <div class="avatar">{{ user.name.slice(0, 1) }}</div>
          <div class="risk-main">
            <strong>{{ user.name }} <small>{{ user.studentNo }}</small></strong>
            <span>{{ user.major }}</span>
            <div class="risk-tags">
              <i :class="['badge', `badge-${creditTone(user)}`]">信用 {{ user.creditScore }}</i>
              <i class="badge badge-warning">爽约 {{ user.noShowCount }} 次</i>
              <i v-if="isBanned(user, new Date())" class="badge badge-danger">
                禁约中 · 剩余 {{ banRemainingDays(user, new Date()) }} 天
              </i>
            </div>
          </div>
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            :disabled="!user.bannedUntil"
            @click="handleLift(user)"
          >
            解除禁约
          </button>
        </article>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>自习室开放状态</h2>
          <p>关闭后学生端立即不可预约该自习室。</p>
        </div>
      </div>
      <div class="room-status-list">
        <div v-for="room in store.rooms" :key="room.id" class="room-status-item">
          <div>
            <strong>{{ room.name }}</strong>
            <small>{{ room.openTime }}-{{ room.closeTime }} · {{ room.building }}</small>
          </div>
          <button
            type="button"
            :class="['switch', { on: room.status === 'open' }]"
            @click="handleToggleRoom(room)"
          >
            <span></span>
            {{ room.status === 'open' ? '开放中' : '已关闭' }}
          </button>
        </div>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>最近预约</h2>
          <p>最新创建的 6 条预约记录。</p>
        </div>
        <RouterLink class="link-button" to="/admin/reservations">查看全部 →</RouterLink>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>日期</th><th>学生</th><th>自习室 / 座位</th><th>时段</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in recentReservations" :key="item.id">
              <td>{{ item.date }}</td>
              <td>{{ studentName(item.userId) }}</td>
              <td>{{ roomName(item.roomId) }} · {{ seatCode(item.seatId) }}</td>
              <td>{{ item.startTime }}-{{ item.endTime }}</td>
              <td><span :class="['badge', `badge-${statusMeta[item.status].tone}`]">{{ statusMeta[item.status].label }}</span></td>
            </tr>
            <tr v-if="!recentReservations.length">
              <td colspan="5" class="table-empty">暂无预约记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>