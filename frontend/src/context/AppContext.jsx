/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const AppContext = createContext()
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8005'
const DESKTOP_NOTIFIED_STORAGE_KEY = 'acadpulse_desktop_notified_v1'

const TASK_CATEGORIES = new Set(['assignment', 'quiz', 'event', 'exam_schedule'])

function getStoredUser() {
  const storedName = localStorage.getItem('acadpulse_user')
  const storedEmail = localStorage.getItem('acadpulse_user_email')
  const storedId = localStorage.getItem('acadpulse_user_id')
  const storedPhone = localStorage.getItem('acadpulse_user_phone')
  const storedUniversity = localStorage.getItem('acadpulse_university')
  return {
    id: storedId || '',
    fullName: storedName || 'Scholar',
    email: storedEmail || 'student@university.edu',
    phone: storedPhone || '',
    university: storedUniversity || '',
  }
}

function getStoredNotifiedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DESKTOP_NOTIFIED_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistNotifiedIds(set) {
  localStorage.setItem(DESKTOP_NOTIFIED_STORAGE_KEY, JSON.stringify(Array.from(set)))
}

function formatTaskDue(deadline) {
  if (!deadline) return ''

  const parsed = new Date(deadline)
  if (Number.isNaN(parsed.getTime())) return ''

  const day = parsed.getDate()
  const month = parsed.toLocaleString('default', { month: 'short' })
  const time = parsed.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${day} ${month}, ${time}`
}

function formatRelativeTime(dateValue) {
  if (!dateValue) return ''

  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return ''

  const diffMs = Date.now() - parsed.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

function mapUrgencyLabelToTaskUrgency(label) {
  if (['high', 'critical', 'overdue'].includes(label)) return 'urgent'
  if (label === 'medium') return 'warning'
  return 'normal'
}

function getDeadlineTime(deadline) {
  if (!deadline) return Number.POSITIVE_INFINITY
  const parsed = new Date(deadline)
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime()
}

function sortTasksByPriority(tasks) {
  const urgencyWeight = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    overdue: 1,
    none: 0,
  }

  return tasks.slice().sort((a, b) => {
    const scoreDiff = (urgencyWeight[b.urgencyLabel] || 0) - (urgencyWeight[a.urgencyLabel] || 0)
    if (scoreDiff !== 0) return scoreDiff
    return getDeadlineTime(a.deadline) - getDeadlineTime(b.deadline)
  })
}

function getSourceMeta(sourceType) {
  switch ((sourceType || '').toLowerCase()) {
    case 'whatsapp':
      return {
        source: 'whatsapp',
        sourceLabel: 'WhatsApp',
        icon: 'fa-whatsapp',
        iconFamily: 'fa-brands',
      }
    case 'classroom':
      return {
        source: 'classroom',
        sourceLabel: 'Classroom',
        icon: 'fa-google',
        iconFamily: 'fa-brands',
      }
    case 'gmail':
      return {
        source: 'gmail',
        sourceLabel: 'Gmail',
        icon: 'fa-envelope',
        iconFamily: 'fa-solid',
      }
    default:
      return {
        source: 'manual',
        sourceLabel: 'Manual Task',
        icon: 'fa-thumbtack',
        iconFamily: 'fa-solid',
      }
  }
}

function extractManualCourse(messageText) {
  const match = (messageText || '').match(/(?:^|\n\n)Course:\s*(.+?)(?:\n\n|$)/i)
  return match ? match[1].trim() : ''
}

function extractNotificationTitle(messageText, category, sourceLabel) {
  const normalized = (messageText || '').trim()
  if (!normalized) {
    return category ? `${category.replace(/_/g, ' ')} update` : `${sourceLabel} update`
  }

  const firstBlock = normalized.split('\n\n')[0]?.trim() || normalized
  return firstBlock.length > 100 ? `${firstBlock.slice(0, 97)}...` : firstBlock
}

function extractNotificationPreview(messageText) {
  const normalized = (messageText || '').trim()
  if (!normalized) return 'No content available.'

  const blocks = normalized
    .split('\n\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index) => !(index === 1 && /^Course:/i.test(entry)))

  const preview = blocks.slice(1).join(' ').trim() || blocks[0]
  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview
}

function buildUiNotification(notification) {
  const meta = getSourceMeta(notification.source_type)
  return {
    id: String(notification.id),
    backendId: String(notification.id),
    source: meta.source,
    sourceLabel: meta.sourceLabel,
    icon: meta.icon,
    iconFamily: meta.iconFamily,
    sender: notification.sender_name || meta.sourceLabel,
    title: extractNotificationTitle(notification.message_text, notification.category, meta.sourceLabel),
    preview: extractNotificationPreview(notification.message_text),
    time: formatRelativeTime(notification.received_at || notification.created_at),
    receivedAt: notification.received_at || null,
    createdAt: notification.created_at || null,
    rawText: notification.message_text || '',
    course: notification.short_name || notification.course_code || notification.course_name || extractManualCourse(notification.message_text) || '',
    deadline: notification.deadline || null,
    category: notification.category || null,
    urgencyLabel: notification.urgency_label || 'none',
  }
}

function buildTaskFromNotification(notification) {
  const category = (notification.category || '').toLowerCase()
  const isManual = (notification.source_type || '').toLowerCase() === 'manual'
  const hasDeadline = Boolean(notification.deadline)

  if (!isManual && !TASK_CATEGORIES.has(category) && !hasDeadline) {
    return null
  }

  const meta = getSourceMeta(notification.source_type)
  const course = notification.short_name
    || notification.course_code
    || notification.course_name
    || extractManualCourse(notification.message_text)
    || notification.sender_name
    || meta.sourceLabel

  return {
    id: String(notification.id),
    backendId: String(notification.id),
    title: extractNotificationTitle(notification.message_text, notification.category, meta.sourceLabel),
    course,
    due: formatTaskDue(notification.deadline) || 'No deadline set',
    deadline: notification.deadline || null,
    category: category || (isManual ? 'assignment' : null),
    content: extractNotificationPreview(notification.message_text),
    rawText: notification.message_text || '',
    urgency: mapUrgencyLabelToTaskUrgency(notification.urgency_label),
    urgencyLabel: notification.urgency_label || 'none',
    source: meta.source,
    sourceLabel: meta.sourceLabel,
    icon: meta.icon,
    iconFamily: meta.iconFamily,
    isCompleted: Boolean(notification.is_completed),
  }
}

export function AppProvider({ children }) {
  const [tasks, setTasks] = useState([])
  const [notifications, setNotifications] = useState([])
  const [user, setUser] = useState(getStoredUser)
  const [activeTaskModal, setActiveTaskModal] = useState(null)
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('acadpulse_token'))
  const [authReady, setAuthReady] = useState(false)
  const [authUser, setAuthUser] = useState(() => (authToken ? getStoredUser() : null))
  const notifiedTaskIdsRef = useRef(new Set(getStoredNotifiedIds()))

  const persistUser = useCallback((nextUser) => {
    localStorage.setItem('acadpulse_user_id', nextUser.id || '')
    localStorage.setItem('acadpulse_user', nextUser.fullName)
    localStorage.setItem('acadpulse_user_email', nextUser.email || '')
    localStorage.setItem('acadpulse_user_phone', nextUser.phone || '')
    if (nextUser.university) localStorage.setItem('acadpulse_university', nextUser.university)
    setUser(nextUser)
    setAuthUser(nextUser)
  }, [])

  const clearAuthSession = useCallback(() => {
    localStorage.removeItem('acadpulse_token')
    localStorage.removeItem('acadpulse_user_id')
    localStorage.removeItem('acadpulse_user')
    localStorage.removeItem('acadpulse_user_email')
    localStorage.removeItem('acadpulse_user_phone')
    setAuthToken(null)
    setAuthUser(null)
    setUser({
      fullName: 'Scholar',
      email: 'student@university.edu',
      phone: '',
      university: '',
    })
  }, [])

  const completeLoginSession = useCallback((token, nextUser) => {
    localStorage.setItem('acadpulse_token', token)
    setAuthToken(token)
    persistUser({
      id: nextUser.id || '',
      fullName: nextUser.name || nextUser.fullName || 'Scholar',
      email: nextUser.email || '',
      phone: nextUser.phone || user.phone,
      university: nextUser.university || user.university || '',
      degree: nextUser.degree || user.degree || '',
      semester: nextUser.semester || user.semester || '',
    })
  }, [persistUser, user])

  const apiFetch = useCallback(
    async (path, options = {}, requireAuth = true) => {
      const headers = new Headers(options.headers || {})
      if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json')
      }

      if (requireAuth && authToken) {
        headers.set('Authorization', `Bearer ${authToken}`)
      }

      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      })

      const rawText = await response.text()
      let payload = null

      if (rawText) {
        try {
          payload = JSON.parse(rawText)
        } catch {
          payload = { detail: rawText }
        }
      }

      if (!response.ok) {
        const error = new Error(payload?.detail || 'Request failed')
        error.status = response.status
        error.payload = payload
        throw error
      }

      return payload
    },
    [authToken],
  )

  const refreshAuthenticatedUser = useCallback(async () => {
    if (!authToken) {
      setAuthReady(true)
      return null
    }

    try {
      const payload = await apiFetch('/auth/me')
      const nextUser = {
        id: payload.user.id,
        fullName: payload.user.name,
        email: payload.user.email,
        phone: payload.user.phone || user.phone,
        university: payload.user.university || user.university || '',
        degree: payload.user.degree || user.degree || '',
        semester: payload.user.semester || user.semester || '',
      }
      persistUser(nextUser)
      setAuthReady(true)
      return payload.user
    } catch (error) {
      if (error.status === 401) {
        clearAuthSession()
      }
      setAuthReady(true)
      return null
    }
  }, [apiFetch, authToken, clearAuthSession, persistUser, user])

  const refreshNotifications = useCallback(async () => {
    const payload = await apiFetch('/notifications?include_completed=true&limit=200', {}, false)
    const backendRows = Array.isArray(payload?.notifications) ? payload.notifications : []
    const nextNotifications = backendRows.map(buildUiNotification)
    const nextTasks = sortTasksByPriority(backendRows.map(buildTaskFromNotification).filter(Boolean))
    setNotifications(nextNotifications)
    setTasks(nextTasks)
    return {
      notifications: nextNotifications,
      tasks: nextTasks,
    }
  }, [apiFetch])

  useEffect(() => {
    refreshAuthenticatedUser()
  }, [refreshAuthenticatedUser])

  useEffect(() => {
    refreshNotifications().catch((error) => {
      console.error('Failed to load notifications from backend:', error)
    })
  }, [refreshNotifications])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }
    if (window.Notification.permission === 'default') {
      window.Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return
    }
    if (window.Notification.permission !== 'granted') {
      return
    }

    tasks
      .filter((task) => !task.isCompleted && ['high', 'critical'].includes(task.urgencyLabel))
      .forEach((task) => {
        const notificationKey = String(task.backendId || task.id)
        if (notifiedTaskIdsRef.current.has(notificationKey)) {
          return
        }

        const desktopNotification = new window.Notification('AcadPulse Alert', {
          body: `${task.title} • ${task.course} • ${task.due}`,
          tag: `acadpulse-${notificationKey}`,
        })
        desktopNotification.onclick = () => {
          window.focus()
        }

        notifiedTaskIdsRef.current.add(notificationKey)
        persistNotifiedIds(notifiedTaskIdsRef.current)
      })
  }, [tasks])

  const login = useCallback(async (email, password) => {
    const payload = await apiFetch(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false,
    )

    completeLoginSession(payload.token, payload.user)
    return payload
  }, [apiFetch, completeLoginSession])

  const register = useCallback(async (input, maybeEmail, maybePassword) => {
    const payloadBody = typeof input === 'object'
      ? input
      : { name: input, email: maybeEmail, password: maybePassword }
    const payload = await apiFetch(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payloadBody),
      },
      false,
    )
    if (payload?.token && payload?.user) {
      completeLoginSession(payload.token, payload.user)
    }
    return payload
  }, [apiFetch, completeLoginSession])

  const logout = useCallback(() => {
    clearAuthSession()
  }, [clearAuthSession])

  const removeTask = useCallback((id) => {
    setTasks((prev) => prev.filter((task) => task.id !== id))
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
    return true
  }, [])

  const addTask = useCallback((task) => {
    setTasks((prev) => [task, ...prev])
  }, [])

  const createManualTask = useCallback(async (taskInput) => {
    const payload = await apiFetch(
      '/notifications/manual',
      {
        method: 'POST',
        body: JSON.stringify({
          title: taskInput.title,
          course: taskInput.course || '',
          description: taskInput.content || '',
          type: taskInput.type || 'assignment',
          due_date: taskInput.dueDate,
          due_time: taskInput.dueTime,
        }),
      },
      false,
    )

    const notification = payload?.notification
    if (notification) {
      const createdNotification = buildUiNotification(notification)
      const createdTask = buildTaskFromNotification(notification)

      setNotifications((prev) => [createdNotification, ...prev])
      if (createdTask) {
        setTasks((prev) => [createdTask, ...prev])
        return createdTask
      }
    }

    await refreshNotifications()
    return null
  }, [apiFetch, refreshNotifications])

  const completeTask = useCallback(async (task) => {
    if (task?.backendId) {
      await apiFetch(
        `/notifications/${task.backendId}/complete`,
        {
          method: 'PATCH',
          body: JSON.stringify({ completed: true }),
        },
        false,
      )
    }

    setTasks((prev) => prev.filter((item) => item.id !== task.id))
    setNotifications((prev) => prev.filter((item) => item.id !== String(task.backendId || task.id)))
    return true
  }, [apiFetch])

  const updateUser = useCallback((data) => {
    const updated = { ...user, ...data }
    persistUser(updated)
  }, [persistUser, user])

  const value = useMemo(
    () => ({
      API_BASE_URL,
      tasks,
      notifications,
      user,
      authUser,
      authToken,
      authReady,
      isAuthenticated: Boolean(authToken),
      activeTaskModal,
      setActiveTaskModal,
      addTask,
      createManualTask,
      completeTask,
      removeTask,
      updateUser,
      login,
      register,
      logout,
      apiFetch,
      completeLoginSession,
      refreshAuthenticatedUser,
      refreshNotifications,
    }),
    [
      tasks,
      notifications,
      user,
      authUser,
      authToken,
      authReady,
      activeTaskModal,
      addTask,
      createManualTask,
      completeTask,
      removeTask,
      updateUser,
      login,
      register,
      logout,
      apiFetch,
      completeLoginSession,
      refreshAuthenticatedUser,
      refreshNotifications,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useAppContext = () => useContext(AppContext)
