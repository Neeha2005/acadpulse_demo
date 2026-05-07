import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import PageSkeleton from '../components/PageSkeleton';

const SOURCE_FILTERS = ['All', 'WhatsApp', 'Classroom', 'Gmail', 'Manual'];
const DATE_FILTERS = ['All', 'Today', 'This Week', 'With Deadline'];

function getTime(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isAnnouncement(notification) {
  return (notification.category || '').toLowerCase() === 'announcement';
}

function isToday(value) {
  const time = getTime(value);
  if (!time) return false;
  const date = new Date(time);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function isThisWeek(value) {
  const time = getTime(value);
  if (!time) return false;
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  return time >= sevenDaysAgo && time <= now;
}

function getAnnouncementTone(notification) {
  if (notification.deadline) return 'badge-warning';
  if (notification.urgencyLabel && notification.urgencyLabel !== 'none') return 'badge-warning';
  return 'badge-success';
}

export default function Announcements() {
  const { notifications, refreshNotifications, dataLoading } = useAppContext();
  const [sourceFilter, setSourceFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const announcements = useMemo(
    () => notifications
      .filter(isAnnouncement)
      .slice()
      .sort((a, b) => getTime(b.deadline || b.receivedAt || b.createdAt) - getTime(a.deadline || a.receivedAt || a.createdAt)),
    [notifications],
  );

  const visibleAnnouncements = useMemo(() => announcements.filter((announcement) => {
    const source = (announcement.sourceLabel || announcement.source || '').toLowerCase();
    const course = announcement.course || 'Unassigned';

    if (sourceFilter !== 'All' && source !== sourceFilter.toLowerCase()) return false;
    if (courseFilter !== 'All' && course !== courseFilter) return false;
    if (dateFilter === 'Today' && !isToday(announcement.deadline || announcement.receivedAt || announcement.createdAt)) return false;
    if (dateFilter === 'This Week' && !isThisWeek(announcement.deadline || announcement.receivedAt || announcement.createdAt)) return false;
    if (dateFilter === 'With Deadline' && !announcement.deadline) return false;
    return true;
  }), [announcements, courseFilter, dateFilter, sourceFilter]);

  const courseOptions = useMemo(
    () => ['All', ...Array.from(new Set(announcements.map((item) => item.course || 'Unassigned'))).sort()],
    [announcements],
  );

  const classroomCount = announcements.filter((item) => item.source === 'classroom').length;
  const gmailCount = announcements.filter((item) => item.source === 'gmail').length;
  const deadlineCount = announcements.filter((item) => item.deadline).length;

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
          <span className="hero-kicker">ACADEMIC BROADCASTS</span>
          <h1 className="hero-title">Announcements</h1>
          <p>
            Review notices, reminders, course updates, room changes, and instructor broadcasts from all connected sources.
          </p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Deadline Notes</span>
            <strong>{deadlineCount}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Classroom</span>
            <strong>{classroomCount}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Gmail</span>
            <strong>{gmailCount}</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-pending"><i className="fa-solid fa-bullhorn"></i></div>
            <div className="stat-trend trend-pill trend-pill-pending">total feed</div>
          </div>
          <div className="stat-value stat-value-pending">{announcements.length}</div>
          <div className="stat-label">Announcements</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-messages"><i className="fa-brands fa-google"></i></div>
            <div className="stat-trend trend-pill trend-pill-messages">class stream</div>
          </div>
          <div className="stat-value stat-value-messages">{classroomCount}</div>
          <div className="stat-label">Classroom Notices</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-urgent"><i className="fa-solid fa-clock"></i></div>
            <div className="stat-trend trend-pill trend-pill-urgent">needs attention</div>
          </div>
          <div className="stat-value stat-value-urgent">{deadlineCount}</div>
          <div className="stat-label">With Deadlines</div>
        </div>
      </div>

      <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
        <div className="panel-header" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h2 className="panel-title"><i className="fa-solid fa-bullhorn text-primary"></i> Announcement Feed</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {visibleAnnouncements.length} of {announcements.length} items visible
            </p>
          </div>
          <button className="btn btn-outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div className="list-filter-grid">
          <div className="filters glass-pill-group list-filter-group">
            {SOURCE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          <select className="list-filter-select" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
            {courseOptions.map((course) => (
              <option key={course} value={course}>{course === 'All' ? 'All courses' : course}</option>
            ))}
          </select>
          <div className="filters glass-pill-group list-filter-group">
            {DATE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${dateFilter === filter ? 'active' : ''}`} onClick={() => setDateFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="notification-stream" style={{ padding: '8px 24px 24px' }}>
          {visibleAnnouncements.length === 0 && (
            <div className="empty-state glass-empty-state" style={{ margin: '0 0 16px' }}>
              <div className="empty-state-icon"><i className="fa-solid fa-inbox"></i></div>
              <p style={{ margin: '8px 0 4px' }}>
                {announcements.length === 0 ? 'No announcements yet' : 'No items match your filters'}
              </p>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {announcements.length === 0
                  ? 'Announcements from WhatsApp groups, Gmail, and Google Classroom will appear here once connected.'
                  : 'Try adjusting the source, course, or date filter above.'}
              </span>
            </div>
          )}
          {visibleAnnouncements.length > 0 ? visibleAnnouncements.map((announcement) => (
            <div className="notif-item" key={announcement.id}>
              <div className={`notif-icon-wrap ${announcement.source}`}>
                <i className={`${announcement.iconFamily || 'fa-solid'} ${announcement.icon}`}></i>
              </div>
              <div className="notif-content">
                <div className="notif-header">
                  <span className="notif-sender">{announcement.sender}</span>
                  <span className="notif-time">{announcement.time}</span>
                </div>
                <h4 className="notif-title">{announcement.title}</h4>
                <p className="notif-preview">{announcement.preview}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <span className={`badge ${getAnnouncementTone(announcement)}`}>{announcement.sourceLabel}</span>
                  {announcement.deadline && <span className="badge badge-warning">Deadline linked</span>}
                  {announcement.urgencyLabel && announcement.urgencyLabel !== 'none' && (
                    <span className="badge badge-warning">{announcement.urgencyLabel}</span>
                  )}
                </div>
              </div>
            </div>
          )) : null}
        </div>
      </div>
    </div>
  );
}
