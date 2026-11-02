<script setup>
import { computed, reactive, ref } from 'vue'
import {
  cancelReservation,
  getRoomById,
  getSeatById,
  getUserById,
  markNoShow,
  store
} from '../stores/appStore.js'
import { canCancel } from '../domain/reservation.js'
import { formatDateLabel, weekdayLabel } from '../domain/time.js'

const filters = reactive({ status: 'all', date: '', keyword: '' })
const message = ref(null)

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'reserved', label: '待签到' },
  { value: 'checked_in', label: '已签到' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
  { value: 'no_show', label: '爽约' }
]

const statusMeta = {
  reserved: { label: '待签到', tone: 'info' },
  checked_in: { label: '已签到', tone: 'success' },
  completed: { label: '已完成', tone: 'neutral' },
  cancelled: { label: '已取消', tone: 'muted' },
  no_show: { label: '爽约', tone: 'danger' }
}

const filtered = computed(() =>
  store.reservations
    .filter((item) => filters.status === 'all' || item.status === filters.status)
    .filter((item) => !filters.date || item.date === filters.date)
    .filter((item) => {
      if (!filters.keyword.trim()) return true
      const keyword = filters.keyword.trim().toLowerCase()
      const user = getUserById(item.userId)
      const room = getRoomById(item.roomId)
      const seat = getSeatById(item.seatId)
      return [user?.name, user?.studentNo, room?.name, seat?.code, item.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
    .slice()
    .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`))
)

const counts = computed(() => {
  const all = store.reservations
  return {
    total: all.length,
    reserved: all.filter((item) => item.status === 'reserved').length,
    no_show: all.filter((item) => item.status === 'no_show').length
  }
})

function showMessage(text, tone = 'success') {
  message.value = { text, tone }
  setTimeout(() => {
    message.value = null
  }, 3500)
}

function studentName(id) {
  const user = getUserById(id)
  return user ? `${user.name}（${user.studentNo}）` : '未知学生'
}

function roomName(id) {
  return getRoomById(id)?.name || '未知'
}

function seatCode(id) {
  return getSeatById(id)?.code || '未知'
}

function handleNoShow(item) {
  if (!window.confirm(`确认将 ${studentName(item.userId)} 在 ${item.date} ${item.startTime} 的预约标记为爽约吗？`)) return
  const result = markNoShow(item.id, new Date())
  showMessage(result.message, result.ok ? 'warning' : 'danger')
}

function handleCancel(item) {
  if (!window.confirm('确认取消该预约吗？取消后座位将立即释放。')) return
  const result = cancelReservation(item.id, new Date())
  showMessage(result.message, result.ok ? 'success' : 'danger')
}

function resetFilters() {
  filters.status = 'all'
  filters.date = ''
  filters.keyword = ''
}
</script>

<template>
  <div class="admin-reservations">
    <div v-if="message" :class="['alert', `alert-${message.tone}`]">{{ message.text }}</div>

    <section class="card section-card">
      <div class="section-title">
        <div>
          <h2>预约记录</h2>
          <p>共 {{ counts.total }} 条记录，待签到 {{ counts.reserved }} 条，爽约 {{ counts.no_show }} 条。</p>
        </div>
      </div>

      <div class="filter-grid">
        <label class="field field-inline">
          <span>状态</span>
          <select v-model="filters.status">
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="field field-inline">
          <span>日期</span>
          <input v-model="filters.date" type="date" />
        </label>
        <label class="field field-inline grow">
          <span>关键词</span>
          <input v-model="filters.keyword" placeholder="学生姓名 / 学号 / 自习室 / 座位号" />
        </label>
        <button class="btn btn-ghost" type="button" @click="resetFilters">重置筛选</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>日期 / 星期</th>
              <th>学生</th>
              <th>自习室 / 座位</th>
              <th>时段</th>
              <th>备注</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="item.id">
              <td>
                <strong>{{ formatDateLabel(item.date) }}</strong>
                <small class="cell-sub">{{ weekdayLabel(item.date) }}</small>
              </td>
              <td>{{ studentName(item.userId) }}</td>
              <td>{{ roomName(item.roomId) }} · {{ seatCode(item.seatId) }}</td>
              <td>{{ item.startTime }}-{{ item.endTime }}</td>
              <td class="note-cell">{{ item.note || '—' }}</td>
              <td>
                <span :class="['badge', `badge-${statusMeta[item.status].tone}`]">{{ statusMeta[item.status].label }}</span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    class="btn btn-danger-ghost btn-xs"
                    type="button"
                    :disabled="item.status !== 'reserved'"
                    @click="handleNoShow(item)"
                  >
                    标记爽约
                  </button>
                  <button
                    class="btn btn-ghost btn-xs"
                    type="button"
                    :disabled="!canCancel(item, new Date())"
                    @click="handleCancel(item)"
                  >
                    取消
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="7" class="table-empty">没有符合筛选条件的预约记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>