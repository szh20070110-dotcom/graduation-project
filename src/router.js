import { createRouter, createWebHashHistory } from 'vue-router'
import { currentUser } from './stores/appStore.js'
import LoginView from './views/LoginView.vue'
import StudentHome from './views/StudentHome.vue'
import MyReservations from './views/MyReservations.vue'
import AdminDashboard from './views/AdminDashboard.vue'
import AdminReservations from './views/AdminReservations.vue'

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/student', name: 'student-home', component: StudentHome, meta: { role: 'student' } },
  { path: '/student/reservations', name: 'my-reservations', component: MyReservations, meta: { role: 'student' } },
  { path: '/admin', name: 'admin-dashboard', component: AdminDashboard, meta: { role: 'admin' } },
  { path: '/admin/reservations', name: 'admin-reservations', component: AdminReservations, meta: { role: 'admin' } },
  { path: '/', redirect: () => (currentUser.value ? (currentUser.value.role === 'admin' ? '/admin' : '/student') : '/login') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const user = currentUser.value
  if (to.meta.public) {
    if (user) return user.role === 'admin' ? '/admin' : '/student'
    return true
  }
  if (!user) return '/login'
  if (to.meta.role && to.meta.role !== user.role) {
    return user.role === 'admin' ? '/admin' : '/student'
  }
  return true
})

export default router