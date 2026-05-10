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
  const weekScheduledCount = weekMapping.reduce((count, day) => count + day.items.length, 0)
  const activeWeekdays = weekMapping.filter((day) => day.items.length > 0).length

  return (
    <div className="dashboard-scroll timetable-page">
      <section className="timetable-hero glass-banner">
        <div className="timetable-hero-copy">
          <span className="hero-kicker">TIMETABLE</span>
          <h1 className="hero-title">Class Schedule</h1>
          <p className="timetable-hero-text">Manage weekly classes and stay on top of your academic timeline.</p>
          <div className="timetable-hero-signals">
            <span className="timetable-hero-signal"><i className="fa-solid fa-calendar-week"></i> Weekly Overview</span>
            <span className="timetable-hero-signal"><i className="fa-solid fa-bell"></i> Smart Scheduling</span>
            <span className="timetable-hero-signal"><i className="fa-solid fa-user-group"></i> Live Overview</span>
          </div>
        </div>

        <div className="timetable-hero-visual">
          <div className="timetable-visual-ambient ambient-violet"></div>
          <div className="timetable-visual-ambient ambient-cyan"></div>
          <div className="timetable-orbit orbit-one"></div>
          <div className="timetable-orbit orbit-two"></div>
          <div className="timetable-node node-left"></div>
          <div className="timetable-node node-right"></div>
          <div className="timetable-node node-bottom"></div>

          <div className="timetable-board">
            <div className="timetable-board-rings">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="timetable-board-grid">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={`tt-cell-${index}`} className={`timetable-board-cell ${index === 2 || index === 7 || index === 10 ? 'active' : ''}`}></span>
              ))}
            </div>
          </div>

          <div className="timetable-float-card top">
            <div className="timetable-float-icon"><i className="fa-regular fa-bell"></i></div>
            <div>
              <strong>{todayCount} today</strong>
              <span>{todayCount} items today</span>
            </div>
          </div>

          <div className="timetable-float-card side">
            <div className="timetable-float-icon"><i className="fa-regular fa-calendar-check"></i></div>
            <div>
              <strong>{upcomingCount} upcoming</strong>
              <span>{upcomingCount} next 7 days</span>
            </div>
          </div>

          <div className="timetable-float-card bottom">
            <div className="timetable-float-icon"><i className="fa-regular fa-calendar-xmark"></i></div>
            <div>
              <strong>{unscheduledTasks.length} unscheduled</strong>
              <span>{unscheduledTasks.length} not scheduled</span>
            </div>
          </div>
        </div>

        <div className="timetable-hero-rail">
          <div className="timetable-hero-rail-card today">
            <div className="timetable-hero-rail-icon"><i className="fa-regular fa-calendar-day"></i></div>
            <div className="timetable-hero-rail-copy">
              <strong>Today</strong>
              <span>Items today</span>
            </div>
            <div className="timetable-hero-rail-value">{todayCount}</div>
          </div>
          <div className="timetable-hero-rail-card upcoming">
            <div className="timetable-hero-rail-icon"><i className="fa-regular fa-clock"></i></div>
            <div className="timetable-hero-rail-copy">
              <strong>Upcoming</strong>
              <span>Next 7 days</span>
            </div>
            <div className="timetable-hero-rail-value">{upcomingCount}</div>
          </div>
          <div className="timetable-hero-rail-card unscheduled">
            <div className="timetable-hero-rail-icon"><i className="fa-regular fa-calendar-xmark"></i></div>
            <div className="timetable-hero-rail-copy">
              <strong>Unscheduled</strong>
              <span>Not scheduled</span>
            </div>
            <div className="timetable-hero-rail-value">{unscheduledTasks.length}</div>
          </div>
        </div>
      </section>

      <section className="timetable-week-shell glass-panel panel-accent timetable-panel">
        <div className="timetable-week-header">
          <div className="timetable-week-title-wrap">
            <div className="timetable-week-title-icon">
              <i className="fa-regular fa-calendar"></i>
            </div>
            <div>
              <h2 className="timetable-week-title">{view === 'week' ? 'This Week' : formatMonthLabel(today)}</h2>
              <p className="timetable-week-count">{scheduledTasks.length} dated items from your integration pipeline</p>
            </div>
          </div>
          <div className="timetable-week-actions">
            <div className="timetable-view-switch glass-pill-group">
              <button className={`filter-btn glass-filter-pill ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
              <button className={`filter-btn glass-filter-pill ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
            </div>
          </div>
        </div>

        <div className="timetable-week-summary">
          <div className="timetable-week-summary-card">
            <span>Week items</span>
            <strong>{weekScheduledCount}</strong>
          </div>
          <div className="timetable-week-summary-card">
            <span>Active days</span>
            <strong>{activeWeekdays}</strong>
          </div>
          <div className="timetable-week-summary-card">
            <span>View</span>
            <strong>{view === 'week' ? 'Week' : 'Month'}</strong>
          </div>
        </div>

        <div className="timetable-week-body">
          {view === 'week' ? (
            <div className="timetable-week-grid">
              {weekMapping.map((dayBlock) => (
                <div
                  key={dayBlock.date.toISOString()}
                  className={`timetable-day-card ${dayBlock.items.length > 0 ? 'has-items' : ''} ${sameDay(dayBlock.date, today) ? 'is-today' : ''}`}
                >
                  <h3 className="timetable-day-label">
                    {formatDayLabel(dayBlock.date)}
                  </h3>
                  <div className="timetable-day-items">
                    {dayBlock.items.length > 0 ? (
                      dayBlock.items.map((task) => <ScheduleItem key={task.id} task={task} onOpen={setActiveTaskModal} />)
                    ) : (
                      <div className="timetable-day-empty">No scheduled items</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="timetable-month-grid">
              {WEEKDAYS.map((day) => (
                <div key={day} className="timetable-month-head">{day}</div>
              ))}
              {monthCells.map((block) => {
                const activeDay = sameDay(block.date, today)
                return (
                  <div
                    key={block.date.toISOString()}
                    className={`timetable-month-cell ${activeDay ? 'is-today' : ''} ${block.items.length > 0 ? 'has-items' : ''} ${block.isCurrentMonth ? '' : 'is-muted'}`}
                  >
                    <span className="timetable-month-date">
                      {block.date.getDate()}
                    </span>
                    <div className="timetable-month-items">
                      {block.items.slice(0, 3).map((task) => (
                        <ScheduleItem key={task.id} task={task} compact onOpen={setActiveTaskModal} />
                      ))}
                      {block.items.length > 3 && (
                        <span className="timetable-month-more">+{block.items.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <ClassScheduleSection apiFetch={apiFetch} userId={authUser?.id || user?.id || ''} title="Class Schedule" marginTop={24} />
    </div>
  )
}