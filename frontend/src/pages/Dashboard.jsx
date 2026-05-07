import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import AttachmentList from '../components/AttachmentList';
import ClassScheduleSection from '../components/ClassScheduleSection';
import TaskCard from '../components/TaskCard';
import PageSkeleton from '../components/PageSkeleton';

export default function Dashboard() {
  const { tasks, user, notifications, dataLoading, apiFetch, refreshNotifications, authToken } = useAppContext();
  const [activeFilter, setActiveFilter] = useState('All');
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  if (dataLoading) return <PageSkeleton variant="dashboard" />;

  const firstName = user.fullName ? user.fullName.split(' ')[0] : 'Scholar';
  const pendingTasks = tasks.filter(task => !task.isCompleted);
  const urgentCount = pendingTasks.filter(task => task.urgency === 'urgent').length;
  const pendingCount = pendingTasks.length;
  const messageCount = notifications.length;
  const risingCount = Math.max(0, Math.ceil(pendingTasks.length / 2));

  const filteredNotifs = activeFilter === 'All'
    ? notifications
    : notifications.filter(n => n.source.toLowerCase() === activeFilter.toLowerCase());

  const urgentTasks = isTasksExpanded ? pendingTasks : pendingTasks.slice(0, 3);

  const handleSeedData = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const res = await apiFetch('/dev/seed', { method: 'POST' });
      const n = res?.seeded?.notifications ?? 0;
      const t = res?.seeded?.timetable_slots ?? 0;
      setSeedMsg(`Loaded ${n} sample notifications${t ? ` and ${t} timetable slots` : ''}.`);
      await refreshNotifications();
    } catch (err) {
      setSeedMsg(err?.message || 'Could not load sample data.');
    } finally {
      setSeeding(false);
    }
  };

  const isEmpty = notifications.length === 0 && tasks.length === 0;

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="hero-orb"></div>
        <div className="welcome-text">
          <span className="hero-kicker">STUDENT OPERATIONS</span>
          <h1 className="hero-title">Welcome back, <span className="accent">{firstName}</span>.</h1>
          <p>
            You have <strong className="text-warning">{urgentCount} active deadlines</strong>,
            <strong className="text-warning"> {risingCount} items rising</strong>.
          </p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Critical</span>
            <strong>{urgentCount}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Pending</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Messages</span>
            <strong>{messageCount}</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-urgent"><i className="fa-solid fa-fire"></i></div>
            <div className="stat-trend trend-pill trend-pill-urgent"><i className="fa-solid fa-arrow-down"></i> live urgency</div>
          </div>
          <div className="stat-value stat-value-urgent">{urgentCount}</div>
          <div className="stat-label">Urgent Deadlines</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-pending"><i className="fa-solid fa-clock-rotate-left"></i></div>
            <div className="stat-trend trend-pill trend-pill-pending"><i className="fa-solid fa-arrow-up"></i> pending queue</div>
          </div>
          <div className="stat-value stat-value-pending">{pendingCount}</div>
          <div className="stat-label">Pending Assignments</div>
        </div>
      </div>

      {isEmpty && authToken && (
        <div className="panel glass-panel panel-accent" style={{ marginTop: 0, marginBottom: 0 }}>
          <div style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
                <i className="fa-solid fa-plug text-primary" style={{ marginRight: 8 }}></i>
                No data yet — connect your sources
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                AcadPulse pulls notifications from WhatsApp groups, Gmail, and Google Classroom.
                Connect at least one source, or load sample data to explore the dashboard.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Link to="/integrations/whatsapp" className="btn btn-outline" style={{ fontSize: 13 }}>
                <i className="fa-brands fa-whatsapp"></i> Connect WhatsApp
              </Link>
              <Link to="/integrations/gmail" className="btn btn-outline" style={{ fontSize: 13 }}>
                <i className="fa-solid fa-envelope"></i> Connect Gmail
              </Link>
              <Link to="/integrations/classroom" className="btn btn-outline" style={{ fontSize: 13 }}>
                <i className="fa-brands fa-google"></i> Connect Classroom
              </Link>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleSeedData} disabled={seeding}>
                {seeding
                  ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Loading...</>
                  : <><i className="fa-solid fa-flask"></i> Load Sample Data</>}
              </button>
            </div>
            {seedMsg && (
              <p style={{ margin: 0, fontSize: 13, color: seedMsg.includes('Could') ? 'var(--urgent)' : 'var(--success)' }}>
                <i className={`fa-solid ${seedMsg.includes('Could') ? 'fa-triangle-exclamation' : 'fa-check'}`} style={{ marginRight: 6 }}></i>
                {seedMsg}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="panel tasks-panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-bolt text-urgent"></i> Action Required</h2>
            <button className="text-btn gradient-link" onClick={() => setIsTasksExpanded(!isTasksExpanded)}>
              {isTasksExpanded ? 'Show Less' : 'View All'}
            </button>
          </div>
          <div className="tasks-list">
            {urgentTasks.length > 0 ? (
              urgentTasks.map(task => <TaskCard key={task.id} task={task} />)
            ) : (
              <div className="empty-state glass-empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-list-check"></i></div>
                <p style={{ margin: '8px 0 4px' }}>No pending tasks</p>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Tasks appear here once WhatsApp, Gmail, or Classroom sends something with a deadline.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-bars-staggered text-primary"></i> Unified Notification Stream</h2>
            <div className="filters glass-pill-group">
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'All' ? 'active' : ''}`} onClick={() => setActiveFilter('All')}>All</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'WhatsApp' ? 'active' : ''}`} onClick={() => setActiveFilter('WhatsApp')}>WhatsApp</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'Classroom' ? 'active' : ''}`} onClick={() => setActiveFilter('Classroom')}>Classroom</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'Gmail' ? 'active' : ''}`} onClick={() => setActiveFilter('Gmail')}>Gmail</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'Manual' ? 'active' : ''}`} onClick={() => setActiveFilter('Manual')}>Manual</button>
            </div>
          </div>
          <div className="notification-stream" style={{ padding: '0 24px 24px' }}>
            {filteredNotifs.length > 0 ? filteredNotifs.map(n => (
              <div className="notif-item" key={n.id}>
                <div className={`notif-icon-wrap ${n.source}`}><i className={`${n.iconFamily || 'fa-brands'} ${n.icon}`}></i></div>
                <div className="notif-content">
                  <div className="notif-header">
                    <span className="notif-sender">{n.sender}</span>
                    <span className={`source-mini-badge ${n.source}`}>{n.sourceLabel}</span>
                    {n.attachmentCount > 0 && <span className="source-mini-badge" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>{n.attachmentCount} file{n.attachmentCount === 1 ? '' : 's'}</span>}
                    <span className="notif-time">{n.time}</span>
                  </div>
                  <h4 className="notif-title">{n.title}</h4>
                  <p className="notif-preview">{n.preview}</p>
                  <AttachmentList attachments={n.attachments} compact />
                </div>
              </div>
            )) : (
              <div className="empty-state glass-empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-inbox"></i></div>
                <p style={{ margin: '8px 0 4px' }}>
                  {activeFilter === 'All' ? 'No notifications yet' : `No ${activeFilter} messages yet`}
                </p>
                {activeFilter !== 'All' && (
                  <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    Connect {activeFilter} from the Integrations page to see messages here.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ClassScheduleSection
        apiFetch={apiFetch}
        userId={user.id || localStorage.getItem('acadpulse_user_id') || ''}
        title="Dashboard Timetable"
        marginTop={24}
      />
    </div>
  );
}
