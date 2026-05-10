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
  const sourceTone = (task.source || '').toLowerCase();
  const deadlineKnown = Number.isFinite(getEventTime(task));

  return (
    <div className={`event-queue-card ${deadlineKnown ? 'dated' : 'missing-date'} ${sourceTone}`}>
      <div className="event-queue-accent"></div>
      <div className="event-queue-icon-shell">
        <div className={`event-queue-icon ${task.source}`}>
          <i className={`${task.iconFamily || 'fa-solid'} ${task.icon}`}></i>
        </div>
      </div>
      <div className="event-queue-content">
        <div className="event-queue-topline">
          <div className="event-queue-chips">
            <span className="event-queue-course">{task.course || 'General event stream'}</span>
            <span className="event-queue-tag">Event</span>
            <span className={`event-queue-source-badge ${sourceTone}`}>
              <i className={`${task.iconFamily || 'fa-solid'} ${task.icon}`}></i>
              {task.sourceLabel}
            </span>
          </div>
          <span className={`event-queue-deadline ${deadlineKnown ? 'known' : 'unknown'}`}>{task.due}</span>
        </div>
        <p className="event-queue-copy">{task.rawText || task.content || task.title}</p>
      </div>
      <div className="event-queue-arrow">
        <i className="fa-solid fa-arrow-right"></i>
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
    <div className="dashboard-scroll events-page">
      <section className="events-hero glass-banner">
        <div className="events-hero-copy">
          <span className="hero-kicker">Schedule Signals</span>
          <h1 className="hero-title">Events</h1>
          <p className="events-hero-text">
            Track workshops, sessions, seminars, and exam dates from every integration.
          </p>

          <div className="events-hero-signal-row">
            <span className="events-hero-signal"><i className="fa-solid fa-satellite-dish"></i> Updated</span>
            <span className="events-hero-signal"><i className="fa-solid fa-bell"></i> Alerts</span>
            <span className="events-hero-signal"><i className="fa-solid fa-diagram-project"></i> Integrated</span>
          </div>
        </div>

        <div className="events-hero-visual">
          <div className="events-orbit events-orbit-primary"></div>
          <div className="events-orbit events-orbit-secondary"></div>
          <div className="events-orbit-ring ring-one"></div>
          <div className="events-orbit-ring ring-two"></div>

          <div className="events-visual-core">
            <div className="events-core-halo"></div>
            <div className="events-visual-connector connector-one"></div>
            <div className="events-visual-connector connector-two"></div>
            <div className="events-signal-node node-cyan"></div>
            <div className="events-signal-node node-violet"></div>
            <div className="events-signal-node node-gold"></div>

            <div className="events-flow-card main">
              <div className="events-flow-card-head">
                <span className="events-visual-pill">
                  <i className="fa-solid fa-wave-square"></i> Event Workflow
                </span>
              </div>
              <div className="events-flow-row">
                <span className="events-flow-icon success"><i className="fa-solid fa-check"></i></span>
                <div className="events-flow-lines">
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="events-flow-row">
                <span className="events-flow-icon sync"><i className="fa-solid fa-rotate-right"></i></span>
                <div className="events-flow-lines alt">
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="events-flow-row">
                <span className="events-flow-icon alert"><i className="fa-solid fa-bell"></i></span>
                <div className="events-flow-lines faint">
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>

            <div className="events-floating-widget widget-a">
              <strong>{upcomingEvents.length}</strong>
              <span>Upcoming</span>
            </div>
            <div className="events-floating-widget widget-b">
              <strong>{datedEvents.length}</strong>
              <span>Dated</span>
            </div>
            <div className="events-floating-widget widget-c">
              <strong>{noDateEvents.length}</strong>
              <span>Missing</span>
            </div>
          </div>
        </div>

        <div className="events-overview-panel">
          <div className="events-overview-head">
            <span className="events-overview-kicker">Quick Overview</span>
          </div>

          <div className="events-overview-item upcoming">
            <div className="events-overview-icon">
              <i className="fa-regular fa-clock"></i>
            </div>
            <div className="events-overview-copy">
              <strong>Upcoming</strong>
            </div>
            <div className="events-overview-value">{upcomingEvents.length}</div>
          </div>

          <div className="events-overview-item dated">
            <div className="events-overview-icon">
              <i className="fa-regular fa-calendar-check"></i>
            </div>
            <div className="events-overview-copy">
              <strong>Dated</strong>
            </div>
            <div className="events-overview-value">{datedEvents.length}</div>
          </div>

          <div className="events-overview-item missing">
            <div className="events-overview-icon">
              <i className="fa-solid fa-location-crosshairs"></i>
            </div>
            <div className="events-overview-copy">
              <strong>Missing</strong>
            </div>
            <div className="events-overview-value">{noDateEvents.length}</div>
          </div>
        </div>
      </section>

      <section className="events-stats-grid">
        <article className="events-stat-card glass-card">
          <div className="events-stat-ring upcoming">
            <div className="events-stat-ring-core">
              <i className="fa-regular fa-clock"></i>
            </div>
          </div>
          <div className="events-stat-copy">
            <span className="events-stat-kicker">From today</span>
            <strong>{upcomingEvents.length}</strong>
            <div className="events-stat-title">Upcoming Events</div>
          </div>
        </article>

        <article className="events-stat-card glass-card">
          <div className="events-stat-ring dated">
            <div className="events-stat-ring-core">
              <i className="fa-regular fa-calendar-check"></i>
            </div>
          </div>
          <div className="events-stat-copy">
            <span className="events-stat-kicker">Scheduled</span>
            <strong>{datedEvents.length}</strong>
            <div className="events-stat-title">Events With Dates</div>
          </div>
        </article>

        <article className="events-stat-card glass-card">
          <div className="events-stat-ring missing">
            <div className="events-stat-ring-core">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
          </div>
          <div className="events-stat-copy">
            <span className="events-stat-kicker">Needs review</span>
            <strong>{noDateEvents.length}</strong>
            <div className="events-stat-title">Missing Dates</div>
          </div>
        </article>
      </section>

      <section className="events-queue-shell glass-panel panel-accent">
        <div className="events-queue-header">
          <div className="events-queue-title-wrap">
            <div className="events-queue-title-icon">
              <i className="fa-solid fa-calendar-days"></i>
            </div>
            <div>
              <h2 className="events-queue-title">Event Queue</h2>
              <p className="events-queue-count">{visibleEvents.length} of {eventTasks.length} items visible</p>
            </div>
          </div>
          <button className="btn btn-outline events-queue-refresh" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div className="events-queue-divider"></div>

        <div className="events-filter-bar">
          <div className="events-filter-group glass-pill-group">
            <span className="events-filter-label">Source</span>
            <div className="events-filter-controls">
              {SOURCE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="events-filter-group glass-pill-group">
            <span className="events-filter-label">Date State</span>
            <div className="events-filter-controls">
              {DATE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${dateFilter === filter ? 'active' : ''}`} onClick={() => setDateFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="events-queue-list">
          {visibleEvents.length > 0 ? (
            visibleEvents.map((task) => (
              (task.category || '').toLowerCase() === 'event'
                ? <EventItem key={task.id} task={task} />
                : <TaskCard key={task.id} task={task} />
            ))
          ) : (
            <div className="empty-state glass-empty-state events-empty-state">
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
      </section>
    </div>
  );
}