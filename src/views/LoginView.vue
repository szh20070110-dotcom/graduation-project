<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../stores/appStore.js'

const router = useRouter()
const role = ref('student')
const form = reactive({ account: '', password: '' })
const error = ref('')
const submitting = ref(false)

const demoAccounts = computed(() =>
  role.value === 'student'
    ? [
        { account: '2021001', password: '123456', label: '林晓 · 信用 98' },
        { account: '2021003', password: '123456', label: '苏雨 · 有爽约记录' }
      ]
    : [{ account: 'admin', password: 'admin123', label: '系统管理员' }]
)

function switchRole(next) {
  role.value = next
  error.value = ''
  form.account = ''
  form.password = ''
}

function fillDemo(account, password) {
  form.account = account
  form.password = password
  error.value = ''
}

function submit() {
  error.value = ''
  if (!form.account.trim() || !form.password) {
    error.value = '请输入账号和密码'
    return
  }
  submitting.value = true
  const result = login(form.account.trim(), form.password, role.value)
  submitting.value = false
  if (!result.ok) {
    error.value = result.message
    return
  }
  router.push(role.value === 'admin' ? '/admin' : '/student')
}
</script>

<template>
  <div class="login-layout">
    <section class="login-hero">
      <p class="eyebrow">GRADUATION PROJECT · TEMPLATE D</p>
      <h1>把空闲座位<br />留给真正需要的人</h1>
      <p class="hero-text">
        面向校园场景的一体化自习室预约方案：实时查看空闲座位、按 30 分钟粒度预约、签到核验、
        爽约信用计分与运营统计，全部在浏览器本地完成。
      </p>
      <ul class="hero-features">
        <li><span>01</span>时间段切分与座位冲突检测</li>
        <li><span>02</span>签到窗口与爽约自动判定</li>
        <li><span>03</span>信用分与 7 天禁约惩罚</li>
        <li><span>04</span>管理端使用率与时段热度统计</li>
      </ul>
      <div class="hero-note">
        <strong>技术栈</strong>
        <span>Vue 3 · Vite · Vue Router · Vitest · localStorage</span>
      </div>
    </section>

    <section class="login-panel">
      <div class="card login-card">
        <div class="role-tabs">
          <button
            type="button"
            :class="['role-tab', { active: role === 'student' }]"
            @click="switchRole('student')"
          >
            学生登录
          </button>
          <button
            type="button"
            :class="['role-tab', { active: role === 'admin' }]"
            @click="switchRole('admin')"
          >
            管理员登录
          </button>
        </div>

        <form class="login-form" @submit.prevent="submit">
          <label class="field">
            <span>{{ role === 'student' ? '学号' : '管理员账号' }}</span>
            <input
              v-model="form.account"
              :placeholder="role === 'student' ? '例如 2021001' : '例如 admin'"
              autocomplete="username"
            />
          </label>
          <label class="field">
            <span>密码</span>
            <input
              v-model="form.password"
              type="password"
              :placeholder="role === 'student' ? '演示密码 123456' : '演示密码 admin123'"
              autocomplete="current-password"
            />
          </label>
          <p v-if="error" class="form-error">{{ error }}</p>
          <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
            {{ submitting ? '登录中…' : '进入系统' }}
          </button>
        </form>

        <div class="demo-box">
          <p>演示账号（点击自动填充）</p>
          <button
            v-for="account in demoAccounts"
            :key="account.account"
            type="button"
            class="demo-account"
            @click="fillDemo(account.account, account.password)"
          >
            <span>{{ account.account }}</span>
            <small>{{ account.label }}</small>
          </button>
        </div>
        <p class="login-tip">本系统为纯前端演示，账号数据仅保存在当前浏览器。</p>
      </div>
    </section>
  </div>
</template>