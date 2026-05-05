import { useMemo, useState } from 'react';
import TaskCard from '../components/TaskCard';
import { useAppContext } from '../context/AppContext';
import PageSkeleton from '../components/PageSkeleton';

const SOURCE_FILTERS = ['All', 'WhatsApp', 'Classroom', 'Gmail', 'Manual'];
const DATE_FILTERS = ['All', 'Upcoming', 'No Date'];

function getEventTime(task) {
  if (!task.deadline) return Number.POSITIVE_INFINITY;
  const parsed = new Date(task.deadline);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function isEventTask(task) {
  const category = (task.category || '').toLowerCase();
  return category === 'event' || category === 'exam_schedule';
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function EventItem({ task }) {
  return (
    <div className="notif-item" style={{ alignItems: 'flex-start' }}>
      <div className={`notif-icon-wrap ${task.source}`}>
        <i className={`${task.iconFamily || 'fa-solid'} ${task.icon}`}></i>
      </div>
      <div className="notif-content">
        <div className="notif-header">
          <span className="notif-sender">{task.course}</span>
          <span className="badge badge-warning">Event</span>
          <span className="notif-time">{task.due}</span>
        </div>
        <p className="notif-preview">{task.rawText || task.content || task.title}</p>
      </div>
    </div>
  );
}

export default function Events() {
  const { tasks, refreshNotifications, dataLoading } = useAppContext();
  const [sourceFilter, setSourceFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const eventTasks = useMemo(
    () => tasks
      .filter(isEventTask)
      .slice()
      .sort((a, b) => getEventTime(a) - getEventTime(b)),
    [tasks],
  );

  const todayStart = getTodayStart();
  const upcomingEvents = eventTasks.filter((task) => getEventTime(task) >= todayStart);
  const datedEvents = eventTasks.filter((task) => Number.isFinite(getEventTime(task)));
  const noDateEvents = eventTasks.filter((task) => !Number.isFinite(getEventTime(task)));
  const examEvents = eventTasks.filter((task) => (task.category || '').toLowerCase() === 'exam_schedule');

  const visibleEvents = useMemo(() => eventTasks.filter((task) => {
    const source = (task.sourceLabel || task.source || '').toLowerCase();
    const eventTime = getEventTime(task);

    if (sourceFilter !== 'All' && source !== sourceFilter.toLowerCase()) return false;
    if (dateFilter === 'Upcoming' && eventTime < todayStart) return false;
    if (dateFilter === 'No Date' && Number.isFinite(eventTime)) return false;
    return true;
  }), [dateFilter, eventTasks, sourceFilter, todayStart]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (dataLoading) return <PageSkeleton variant="list" />;

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">SCHEDULE SIGNALS</span>
          <h1 className="hero-title">Events</h1>
          <p>
            Monitor workshops, class sessions, seminars, and exam schedules captured from every integration.
          </p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Upcoming</span>
            <strong>{upcomingEvents.length}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Dated</span>
            <strong>{datedEvents.length}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Exams</span>
            <strong>{examEvents.length}</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-pending"><i className="fa-solid fa-calendar-day"></i></div>
            <div className="stat-trend trend-pill trend-pill-pending">from today</div>
          </div>
          <div className="stat-value stat-value-pending">{upcomingEvents.length}</div>
          <div className="stat-label">Upcoming Events</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-messages"><i className="fa-solid fa-calendar-check"></i></div>
            <div className="stat-trend trend-pill trend-pill-messages">scheduled</div>
          </div>
          <div className="stat-value stat-value-messages">{datedEvents.length}</div>
          <div className="stat-label">Events With Dates</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-urgent"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <div className="stat-trend trend-pill trend-pill-urgent">needs review</div>
          </div>
          <div className="stat-value stat-value-urgent">{noDateEvents.length}</div>
          <div className="stat-label">Missing Dates</div>
        </div>
      </div>

      <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
        <div className="panel-header" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h2 className="panel-title"><i className="fa-solid fa-calendar-days text-primary"></i> Event Queue</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {visibleEvents.length} of {eventTasks.length} items visible
            </p>
          </div>
          <button className="btn btn-outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div style={{ padding: '0 24px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div className="filters glass-pill-group" style={{ flexWrap: 'wrap' }}>
            {SOURCE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          <div className="filters glass-pill-group" style={{ flexWrap: 'wrap' }}>
            {DATE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${dateFilter === filter ? 'active' : ''}`} onClick={() => setDateFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="tasks-list" style={{ padding: '8px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {visibleEvents.length > 0 ? (
            visibleEvents.map((task) => (
              (task.category || '').toLowerCase() === 'event'
                ? <EventItem key={task.id} task={task} />
                : <TaskCard key={task.id} task={task} />
            ))
          ) : (
            <div className="empty-state glass-empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon"><i className="fa-solid fa-calendar-xmark"></i></div>
              <p style={{ margin: '8px 0 4px' }}>
                {eventTasks.length === 0 ? 'No events or exam schedules found' : 'No items match your filters'}
              </p>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {eventTasks.length === 0
                  ? 'Events and exam schedules from connected WhatsApp groups, Gmail, and Classroom will appear here.'
                  : 'Try adjusting the source or date filter above.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
