import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import ClassScheduleSection from '../components/ClassScheduleSection'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseDeadline(task) {
  if (!task.deadline) return null
  const parsed = new Date(task.deadline)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatTaskTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getTaskBorderColor(task) {
  if (task.urgency === 'urgent') return 'var(--urgent)'
  if (task.source === 'whatsapp') return 'var(--whatsapp)'
  if (task.source === 'classroom') return 'var(--warning)'
  if (task.source === 'gmail') return 'var(--urgent)'
  return 'var(--primary)'
}

function buildMonthCells(anchorDate, scheduledTasks) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  const firstVisible = addDays(firstOfMonth, -firstOfMonth.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstVisible, index)
    return {
      date,
      isCurrentMonth: date.getMonth() === anchorDate.getMonth(),
      items: scheduledTasks.filter((task) => sameDay(task.deadlineDate, date)),
    }
  })
}

function ScheduleItem({ task, compact = false, onOpen }) {
  const borderColor = getTaskBorderColor(task)

  return (
    <button
      className={`schedule-item ${compact ? 'compact' : ''}`}
      type="button"
      onClick={() => onOpen(task)}
      title={`${task.title} - ${task.course}\nDue: ${task.due || 'No deadline set'}`}
      style={{ '--schedule-color': borderColor }}
    >
      <span className="schedule-item-time">
        {task.deadlineDate ? formatTaskTime(task.deadlineDate) : 'No time'}
      </span>
      <h4>{task.title}</h4>
      <p>{task.course}</p>
    </button>
  )
}

export default function Timetable() {
  const [view, setView] = useState('week')
  const { tasks, setActiveTaskModal, apiFetch, authUser, user } = useAppContext()
  const userId = authUser?.id || user?.id || localStorage.getItem('acadpulse_user_id') || ''

  const today = startOfDay(new Date())
  const weekStart = addDays(today, -today.getDay())
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const scheduledTasks = useMemo(
    () => tasks
      .map((task) => ({ ...task, deadlineDate: parseDeadline(task) }))
      .filter((task) => task.deadlineDate)
      .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime()),
    [tasks],
  )

  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !parseDeadline(task)),
    [tasks],
  )

  const weekMapping = weekDays.map((date) => ({
    date,
    items: scheduledTasks.filter((task) => sameDay(task.deadlineDate, date)),
  }))

  const monthCells = buildMonthCells(today, scheduledTasks)
  const upcomingCount = scheduledTasks.filter((task) => task.deadlineDate >= today).length
  const todayCount = scheduledTasks.filter((task) => sameDay(task.deadlineDate, today)).length

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">TIMETABLE</span>
          <h1 className="hero-title">Schedule</h1>
          <p>Classes and dated academic items in one clean view.</p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Today</span>
            <strong>{todayCount}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Upcoming</span>
            <strong>{upcomingCount}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Unscheduled</span>
            <strong>{unscheduledTasks.length}</strong>
          </div>
        </div>
      </section>

      <div className="panel glass-panel panel-accent timetable-panel">
        <div className="panel-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div>
            <h2 className="panel-title"><i className="fa-regular fa-calendar text-primary"></i> {view === 'week' ? 'This Week' : formatMonthLabel(today)}</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {scheduledTasks.length} dated items from your integration pipeline
            </p>
          </div>
          <div className="filters glass-pill-group">
            <button className={`filter-btn glass-filter-pill ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
            <button className={`filter-btn glass-filter-pill ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
          </div>
        </div>

        <div className="modal-body" style={{ minHeight: 420, padding: '24px' }}>
          {view === 'week' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              {weekMapping.map((dayBlock) => (
                <div
                  key={dayBlock.date.toISOString()}
                  style={{
                    minHeight: 260,
                    borderTop: dayBlock.items.length > 0 ? '3px solid var(--primary)' : '3px solid var(--border)',
                    background: dayBlock.items.length > 0 ? 'var(--surface-hover)' : 'transparent',
                    borderRadius: '8px 8px 0 0',
                    padding: 12,
                  }}
                >
                  <h3 style={{ fontSize: 13, color: sameDay(dayBlock.date, today) ? 'var(--warning)' : 'var(--text-muted)', textAlign: 'center', margin: '0 0 16px', textTransform: 'uppercase' }}>
                    {formatDayLabel(dayBlock.date)}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dayBlock.items.length > 0 ? (
                      dayBlock.items.map((task) => <ScheduleItem key={task.id} task={task} onOpen={setActiveTaskModal} />)
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 30 }}>No scheduled items</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(96px, 1fr))', gap: 10, overflowX: 'auto' }}>
              {WEEKDAYS.map((day) => (
                <div key={day} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>{day}</div>
              ))}
              {monthCells.map((block) => {
                const activeDay = sameDay(block.date, today)
                return (
                  <div
                    key={block.date.toISOString()}
                    style={{
                      minHeight: 116,
                      background: block.items.length > 0 ? 'var(--primary-subtle)' : 'var(--surface-hover)',
                      border: activeDay ? '1px solid var(--warning)' : block.items.length > 0 ? '1px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 10,
                      opacity: block.isCurrentMonth ? 1 : 0.45,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <span style={{ fontSize: 13, color: activeDay ? 'var(--warning)' : block.items.length > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
                      {block.date.getDate()}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      {block.items.slice(0, 3).map((task) => (
                        <ScheduleItem key={task.id} task={task} compact onOpen={setActiveTaskModal} />
                      ))}
                      {block.items.length > 3 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{block.items.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ClassScheduleSection apiFetch={apiFetch} userId={userId} />
    </div>
  )
}
