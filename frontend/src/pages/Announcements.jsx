import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import PageSkeleton from '../components/PageSkeleton';

const SOURCE_FILTERS = ['All', 'WhatsApp', 'Classroom', 'Gmail', 'Manual'];
const DATE_FILTERS = ['All', 'Today', 'This Week', 'With Deadline'];

function getSourceMeta(notification) {
  const source = (notification.source || '').toLowerCase();
  if (source === 'whatsapp') {
    return { iconFamily: 'fa-brands', icon: 'fa-whatsapp', tone: 'whatsapp', label: notification.sourceLabel || 'WhatsApp' };
  }
  if (source === 'classroom') {
    return { iconFamily: 'fa-brands', icon: 'fa-google', tone: 'classroom', label: notification.sourceLabel || 'Classroom' };
  }
  if (source === 'gmail') {
    return { iconFamily: 'fa-solid', icon: 'fa-envelope', tone: 'gmail', label: notification.sourceLabel || 'Gmail' };
  }
  return { iconFamily: notification.iconFamily || 'fa-solid', icon: notification.icon || 'fa-bell', tone: 'manual', label: notification.sourceLabel || 'Manual' };
}

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
  const withDeadlinesCount = deadlineCount;

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
    <div className="dashboard-scroll announcements-page">
      <section className="announcements-hero glass-banner">
        <div className="announcements-hero-copy">
          <span className="hero-kicker">ACADEMIC BROADCASTS</span>
          <h1 className="hero-title">Announcements</h1>
          <p className="announcements-hero-text">
            Review notices, reminders, course updates, and instructor broadcasts from every source.
          </p>
          <div className="announcements-hero-signals">
            <span className="announcements-hero-signal"><i className="fa-solid fa-bolt"></i> Live Updates</span>
            <span className="announcements-hero-signal"><i className="fa-solid fa-chalkboard"></i> Classroom Notices</span>
            <span className="announcements-hero-signal"><i className="fa-solid fa-broadcast-tower"></i> Instructor Broadcasts</span>
          </div>
        </div>

        <div className="announcements-hero-visual">
          <div className="announcements-visual-ambient ambient-magenta"></div>
          <div className="announcements-visual-ambient ambient-amber"></div>
          <div className="announcements-broadcast-ring ring-one"></div>
          <div className="announcements-broadcast-ring ring-two"></div>
          <div className="announcements-wave-line wave-top"></div>
          <div className="announcements-wave-line wave-bottom"></div>

          <div className="announcements-megaphone-shell">
            <div className="announcements-megaphone-core">
              <i className="fa-solid fa-bullhorn"></i>
            </div>
          </div>

          <div className="announcements-feed-card feed-top">
            <div className="announcements-feed-card-icon instructor">
              <i className="fa-solid fa-user-tie"></i>
            </div>
            <div className="announcements-feed-card-copy">
              <strong>Instructor</strong>
              <span>New announcement</span>
            </div>
            <em>Now</em>
          </div>

          <div className="announcements-feed-card feed-mid">
            <div className="announcements-feed-card-icon classroom">
              <i className="fa-brands fa-google"></i>
            </div>
            <div className="announcements-feed-card-copy">
              <strong>Classroom</strong>
              <span>New update posted</span>
            </div>
            <em>10m</em>
          </div>

          <div className="announcements-feed-card feed-bottom">
            <div className="announcements-feed-card-icon gmail">
              <i className="fa-solid fa-envelope"></i>
            </div>
            <div className="announcements-feed-card-copy">
              <strong>Gmail</strong>
              <span>Important notice</span>
            </div>
            <em>30m</em>
          </div>

          <div className="announcements-pulse pulse-left"></div>
          <div className="announcements-pulse pulse-right"></div>
        </div>

        <div className="announcements-hero-rail">
          <div className="announcements-hero-rail-card deadlines">
            <div className="announcements-hero-rail-icon"><i className="fa-regular fa-bell"></i></div>
            <div className="announcements-hero-rail-copy">
              <strong>Deadline Notes</strong>
              <span>Pending reminders</span>
            </div>
            <div className="announcements-hero-rail-value">{deadlineCount}</div>
          </div>
          <div className="announcements-hero-rail-card classroom">
            <div className="announcements-hero-rail-icon"><i className="fa-brands fa-google"></i></div>
            <div className="announcements-hero-rail-copy">
              <strong>Classroom</strong>
              <span>New updates</span>
            </div>
            <div className="announcements-hero-rail-value">{classroomCount}</div>
          </div>
          <div className="announcements-hero-rail-card gmail">
            <div className="announcements-hero-rail-icon"><i className="fa-solid fa-envelope"></i></div>
            <div className="announcements-hero-rail-copy">
              <strong>Gmail</strong>
              <span>New messages</span>
            </div>
            <div className="announcements-hero-rail-value">{gmailCount}</div>
          </div>
        </div>
      </section>

      <section className="announcements-stats-grid">
        <article className="announcements-stat-card total glass-card">
          <div className="announcements-stat-top">
            <div className="announcements-stat-icon"><i className="fa-solid fa-bullhorn"></i></div>
            <span className="announcements-stat-badge">Total feed</span>
          </div>
          <strong>{announcements.length}</strong>
          <div className="announcements-stat-title">Announcements</div>
        </article>

        <article className="announcements-stat-card classroom glass-card">
          <div className="announcements-stat-top">
            <div className="announcements-stat-icon"><i className="fa-brands fa-google"></i></div>
            <span className="announcements-stat-badge">Class stream</span>
          </div>
          <strong>{classroomCount}</strong>
          <div className="announcements-stat-title">Classroom Notices</div>
        </article>

        <article className="announcements-stat-card deadlines glass-card">
          <div className="announcements-stat-top">
            <div className="announcements-stat-icon"><i className="fa-regular fa-calendar-check"></i></div>
            <span className="announcements-stat-badge">Needs attention</span>
          </div>
          <strong>{withDeadlinesCount}</strong>
          <div className="announcements-stat-title">With Deadlines</div>
        </article>
      </section>

      <section className="announcements-feed-shell glass-panel panel-accent">
        <div className="announcements-feed-ambient ambient-left"></div>
        <div className="announcements-feed-ambient ambient-right"></div>
        <div className="announcements-feed-header">
          <div className="announcements-feed-title-wrap">
            <div className="announcements-feed-title-icon">
              <i className="fa-solid fa-bullhorn"></i>
            </div>
            <div>
              <h2 className="announcements-feed-title">Announcement Feed</h2>
              <p className="announcements-feed-count">{visibleAnnouncements.length} of {announcements.length} items visible</p>
            </div>
          </div>
          <button className="btn btn-outline announcements-feed-refresh" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div className="announcements-feed-divider"></div>

        <div className="announcements-filter-grid">
          <div className="announcements-filter-group glass-pill-group">
            <span className="announcements-filter-label">Source</span>
            <div className="announcements-filter-controls">
              {SOURCE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="announcements-filter-group announcements-filter-select-wrap">
            <span className="announcements-filter-label">Course</span>
            <select className="announcements-filter-select" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
              {courseOptions.map((course) => (
                <option key={course} value={course}>{course === 'All' ? 'All courses' : course}</option>
              ))}
            </select>
          </div>

          <div className="announcements-filter-group glass-pill-group">
            <span className="announcements-filter-label">Timeline</span>
            <div className="announcements-filter-controls">
              {DATE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${dateFilter === filter ? 'active' : ''}`} onClick={() => setDateFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="announcements-feed-list">
          {visibleAnnouncements.length === 0 && (
            <div className="announcements-empty-state">
              <div className="announcements-empty-particles particle-a"></div>
              <div className="announcements-empty-particles particle-b"></div>
              <div className="announcements-empty-icon">
                <i className="fa-solid fa-inbox"></i>
              </div>
              <div className="announcements-empty-copy">
                <h3>{announcements.length === 0 ? 'No announcements yet' : 'No items match your filters'}</h3>
                <p>
                  {announcements.length === 0
                    ? 'Updates from WhatsApp, Gmail, and Classroom will appear here.'
                    : 'Try adjusting the source, course, or timeline filters.'}
                </p>
              </div>
            </div>
          )}

          {visibleAnnouncements.length > 0 ? visibleAnnouncements.map((announcement) => {
            const sourceMeta = getSourceMeta(announcement);
            return (
              <article className={`announcements-feed-card-row ${sourceMeta.tone}`} key={announcement.id}>
                <div className="announcements-feed-card-accent"></div>
                <div className={`announcements-feed-card-source ${sourceMeta.tone}`}>
                  <i className={`${sourceMeta.iconFamily} ${sourceMeta.icon}`}></i>
                </div>
                <div className="announcements-feed-card-body">
                  <div className="announcements-feed-card-head">
                    <div className="announcements-feed-card-meta">
                      <strong>{announcement.sender}</strong>
                      <span>{announcement.time}</span>
                    </div>
                    <div className="announcements-feed-card-chips">
                      <span className={`badge ${getAnnouncementTone(announcement)}`}>{sourceMeta.label}</span>
                      {announcement.deadline && <span className="badge badge-warning">Deadline linked</span>}
                      {announcement.urgencyLabel && announcement.urgencyLabel !== 'none' && (
                        <span className="badge badge-warning">{announcement.urgencyLabel}</span>
                      )}
                    </div>
                  </div>
                  <h4 className="announcements-feed-card-title">{announcement.title}</h4>
                  <p className="announcements-feed-card-preview">{announcement.preview}</p>
                </div>
              </article>
            );
          }) : null}
        </div>
      </section>
    </div>
  );
}
