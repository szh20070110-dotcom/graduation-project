import { addDays, toDateKey } from '../domain/time.js'

export const STORAGE_KEY = 'srms:v1'
export const SESSION_KEY = 'srms:session:v1'
export const SEED_VERSION = 1

const ROOM_DEFS = [
  {
    id: 'room-a101',
    name: '静思苑 A101',
    building: '静思苑',
    floor: 1,
    openTime: '08:00',
    closeTime: '22:00',
    description: '安静自习区，桌面宽大，适合长时间阅读。',
    tags: ['安静', '护眼灯'],
    status: 'open'
  },
  {
    id: 'room-a102',
    name: '静思苑 A102',
    building: '静思苑',
    floor: 1,
    openTime: '08:00',
    closeTime: '22:00',
    description: '靠窗采光好，配备独立插座。',
    tags: ['靠窗', '插座'],
    status: 'open'
  },
  {
    id: 'room-b201',
    name: '图书馆 B201',
    building: '图书馆',
    floor: 2,
    openTime: '08:30',
    closeTime: '21:30',
    description: '图书馆综合自习室，学习氛围浓厚。',
    tags: ['综合', '空调'],
    status: 'open'
  },
  {
    id: 'room-b202',
    name: '图书馆 B202',
    building: '图书馆',
    floor: 2,
    openTime: '08:30',
    closeTime: '21:30',
    description: '研讨型自习室，允许低声讨论。',
    tags: ['研讨', '白板'],
    status: 'open'
  },
  {
    id: 'room-c301',
    name: '创新中心 C301',
    building: '创新创业中心',
    floor: 3,
    openTime: '09:00',
    closeTime: '22:00',
    description: '创客自习空间，插座充足，可预约至晚间。',
    tags: ['插座', '晚间开放'],
    status: 'open'
  }
]

function buildSeats() {
  const seats = []
  for (const room of ROOM_DEFS) {
    for (let index = 1; index <= 12; index += 1) {
      const column = (index - 1) % 4
      const row = Math.floor((index - 1) / 4)
      const code = `${room.id.toUpperCase().replace('ROOM-', '')}-${String(index).padStart(2, '0')}`
      seats.push({
        id: `seat-${room.id.replace('room-', '')}-${String(index).padStart(2, '0')}`,
        roomId: room.id,
        code,
        row,
        column,
        isWindow: column === 0 || column === 3,
        hasSocket: index % 2 === 0,
        zone: row === 0 ? 'quiet' : 'normal',
        status: 'available'
      })
    }
  }
  return seats
}

const STUDENTS = [
  {
    id: 'user-2021001',
    role: 'student',
    name: '林晓',
    account: '2021001',
    studentNo: '2021001',
    major: '计算机科学与技术',
    password: '123456',
    creditScore: 98,
    noShowCount: 0,
    bannedUntil: null,
    banReason: null
  },
  {
    id: 'user-2021002',
    role: 'student',
    name: '陈默',
    account: '2021002',
    studentNo: '2021002',
    major: '软件工程',
    password: '123456',
    creditScore: 96,
    noShowCount: 0,
    bannedUntil: null,
    banReason: null
  },
  {
    id: 'user-2021003',
    role: 'student',
    name: '苏雨',
    account: '2021003',
    studentNo: '2021003',
    major: '数据科学与大数据技术',
    password: '123456',
    creditScore: 90,
    noShowCount: 1,
    bannedUntil: null,
    banReason: null
  }
]

export function createSeedData(now = new Date()) {
  const rooms = ROOM_DEFS.map((room) => ({ ...room, tags: [...room.tags] }))
  const seats = buildSeats()
  const users = [
    {
      id: 'user-admin',
      role: 'admin',
      name: '系统管理员',
      account: 'admin',
      password: 'admin123',
      department: '教务处'
    },
    ...STUDENTS.map((student) => ({ ...student }))
  ]
  const date = addDays(toDateKey(now), 1)
  const createdAt = now.toISOString()
  const reservations = [
    {
      id: 'demo-r1',
      userId: 'user-2021001',
      seatId: 'seat-a101-03',
      roomId: 'room-a101',
      date,
      startTime: '09:00',
      endTime: '11:00',
      status: 'reserved',
      note: '考研数学复习',
      createdAt
    },
    {
      id: 'demo-r2',
      userId: 'user-2021002',
      seatId: 'seat-a101-07',
      roomId: 'room-a101',
      date,
      startTime: '10:00',
      endTime: '12:00',
      status: 'reserved',
      note: '软件工程课程设计',
      createdAt
    },
    {
      id: 'demo-r3',
      userId: 'user-2021001',
      seatId: 'seat-b201-02',
      roomId: 'room-b201',
      date,
      startTime: '14:00',
      endTime: '16:00',
      status: 'reserved',
      note: '英语六级真题',
      createdAt
    },
    {
      id: 'demo-r4',
      userId: 'user-2021003',
      seatId: 'seat-b202-05',
      roomId: 'room-b202',
      date,
      startTime: '15:00',
      endTime: '17:00',
      status: 'reserved',
      note: '小组研讨',
      createdAt
    },
    {
      id: 'demo-r5',
      userId: 'user-2021002',
      seatId: 'seat-c301-01',
      roomId: 'room-c301',
      date,
      startTime: '19:00',
      endTime: '21:00',
      status: 'reserved',
      note: '算法竞赛训练',
      createdAt
    }
  ]
  return {
    version: SEED_VERSION,
    seedAt: now.toISOString(),
    users,
    rooms,
    seats,
    reservations
  }
}