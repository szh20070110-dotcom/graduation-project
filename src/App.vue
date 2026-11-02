<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { currentUser, isAdmin, logout, settleReservations, sweepNoShows } from './stores/appStore.js'

const route = useRoute()
const router = useRouter()

const navItems = computed(() => {
  if (!currentUser.value) return []
  if (isAdmin.value) {
    return [
      { to: '/admin', label: '数据概览' },
      { to: '/admin/reservations', label: '预约管理' }
    ]
  }
  return [
    { to: '/student', label: '查找座位' },
    { to: '/student/reservations', label: '我的预约' }
  ]
})

const pageTitle = computed(() => {
  const map = {
    'student-home': '查找空闲座位',
    'my-reservations': '我的预约与信用',
    'admin-dashboard': '运营数据概览',
    'admin-reservations': '预约记录管理'
  }
  return map[route.name] || '校园自习室预约系统'
})

function handleLogout() {
  logout()
  router.push('/login')
}

let timer = null
onMounted(() => {
  settleReservations()
  sweepNoShows()
  timer = setInterval(() => {
    if (currentUser.value) {
      settleReservations()
      sweepNoShows()
    }
  }, 60_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <RouterLink class="brand" to="/">
          <span class="brand-mark">SR</span>
          <span>
            <strong>校园自习室预约系统</strong>
            <small>Study Room Management</small>
          </span>
        </RouterLink>
        <nav v-if="currentUser" class="main-nav">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link">
            {{ item.label }}
          </RouterLink>
        </nav>
        <div v-if="currentUser" class="user-box">
          <span class="user-meta">
            <strong>{{ currentUser.name }}</strong>
            <small>{{ isAdmin ? '管理员' : `学号 ${currentUser.studentNo}` }}</small>
          </span>
          <button class="btn btn-ghost btn-sm" type="button" @click="handleLogout">退出</button>
        </div>
      </div>
    </header>

    <main class="page">
      <div v-if="currentUser" class="page-heading">
        <div>
          <p class="eyebrow">{{ isAdmin ? 'ADMIN CONSOLE' : 'STUDENT PORTAL' }}</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="heading-meta">
          <span class="dot"></span>
          数据保存在本地浏览器 localStorage
        </div>
      </div>
      <RouterView />
    </main>

    <footer class="footer">
      <span>校园自习室预约系统 · 毕业设计演示项目</span>
      <span>Vue 3 + Vite · 纯前端 · localStorage 持久化</span>
    </footer>
  </div>
</template>