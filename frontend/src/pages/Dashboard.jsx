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
  const pendingTasks = tasks.filter((task) => !task.isCompleted);
  const completedCount = tasks.filter((task) => task.isCompleted).length;
  const urgentCount = pendingTasks.filter((task) => task.urgency === 'urgent').length;
  const pendingCount = pendingTasks.length;
  const messageCount = notifications.length;
  const risingCount = Math.max(0, Math.ceil(pendingTasks.length / 2));
  const productivityScore = tasks.length > 0 ? Math.max(12, Math.min(98, Math.round((completedCount / tasks.length) * 100))) : 92;
  const weeklyFocusHours = pendingTasks.length > 0 ? `${Math.max(2.5, pendingTasks.length * 1.9).toFixed(1)} hrs` : '7.5 hrs';
  const reminderStatus = urgentCount > 0 ? 'Active' : pendingCount > 0 ? 'On Track' : 'All Clear';
  const filteredNotifs = activeFilter === 'All'
    ? notifications
    : notifications.filter((notification) => notification.source.toLowerCase() === activeFilter.toLowerCase());

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
    <div className="dashboard-scroll dashboard-page">
      <section className="dashboard-command-hero glass-banner">
        <div className="dashboard-command-ambient ambient-gold"></div>
        <div className="dashboard-command-ambient ambient-cyan"></div>

        <div className="dashboard-command-copy">
          <span className="hero-kicker">STUDENT OPERATIONS</span>
          <h1 className="hero-title">Welcome back, <span className="accent">{firstName}</span>.</h1>
          <p className="dashboard-command-text">
            You have <strong className="text-warning">{urgentCount} active deadlines</strong>,
            <strong className="text-warning"> {risingCount} items rising</strong>.
          </p>
        </div>

        <div className="dashboard-command-visual">
          <div className="dashboard-visual-grid"></div>
          <div className="dashboard-command-orbit orbit-one"></div>
          <div className="dashboard-command-orbit orbit-two"></div>
          <div className="dashboard-command-orbit orbit-three"></div>
          <div className="dashboard-signal-path path-one"></div>
          <div className="dashboard-signal-path path-two"></div>
          <div className="dashboard-signal-path path-three"></div>
          <div className="dashboard-command-node node-a"></div>
          <div className="dashboard-command-node node-b"></div>
          <div className="dashboard-command-node node-c"></div>
          <div className="dashboard-command-node node-d"></div>
          <div className="dashboard-visual-particle particle-a"></div>
          <div className="dashboard-visual-particle particle-b"></div>
          <div className="dashboard-visual-particle particle-c"></div>
          <div className="dashboard-beam"></div>

          <div className="dashboard-ai-orb-shell">
            <div className="dashboard-ai-orb-base"></div>
            <div className="dashboard-ai-orb-ring ring-outer"></div>
            <div className="dashboard-ai-orb-ring ring-inner"></div>
            <div className="dashboard-ai-orb-ring ring-core"></div>
            <div className="dashboard-ai-orb-plate plate-back"></div>
            <div className="dashboard-ai-orb-plate plate-mid"></div>
            <div className="dashboard-ai-orb-plate plate-front"></div>
            <div className="dashboard-ai-orb-core">
              <div className="dashboard-ai-eye eye-left"></div>
              <div className="dashboard-ai-eye eye-right"></div>
              <div className="dashboard-ai-mouth"></div>
            </div>
          </div>

          <div className="dashboard-widget-card card-top">
            <span className="dashboard-widget-kicker">Learning Ops</span>
            <strong>{urgentCount}-Late</strong>
            <small>Today, 12:30 AM</small>
          </div>

          <div className="dashboard-widget-card card-left">
            <span className="dashboard-widget-kicker">Assignments</span>
            <strong>{pendingCount} Active</strong>
            <small>Due in 3 days</small>
          </div>

          <div className="dashboard-widget-card card-right">
            <span className="dashboard-widget-kicker">Study Reminder</span>
            <strong>Check syllabus</strong>
            <small>Now active</small>
          </div>

          <div className="dashboard-widget-card card-bottom">
            <span className="dashboard-widget-kicker">Ready Review</span>
            <strong>{messageCount} Streams</strong>
            <small>Live activity</small>
          </div>

          <div className="dashboard-visual-pill pill-left">
            <i className="fa-solid fa-wave-square"></i>
            <span>AI Assist Live</span>
          </div>

          <div className="dashboard-visual-pill pill-right">
            <i className="fa-solid fa-sparkles"></i>
            <span>Focus Mode</span>
          </div>
        </div>

        <div className="dashboard-hero-rail">
          <div className="dashboard-hero-rail-card critical">
            <div className="dashboard-hero-rail-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <div className="dashboard-hero-rail-copy">
              <strong>Critical</strong>
              <span>Urgent attention</span>
            </div>
            <div className="dashboard-hero-rail-value">{urgentCount}</div>
          </div>
          <div className="dashboard-hero-rail-card pending">
            <div className="dashboard-hero-rail-icon"><i className="fa-regular fa-clock"></i></div>
            <div className="dashboard-hero-rail-copy">
              <strong>Pending</strong>
              <span>Awaiting action</span>
            </div>
            <div className="dashboard-hero-rail-value">{pendingCount}</div>
          </div>
          <div className="dashboard-hero-rail-card messages">
            <div className="dashboard-hero-rail-icon"><i className="fa-solid fa-comment-dots"></i></div>
            <div className="dashboard-hero-rail-copy">
              <strong>Messages</strong>
              <span>New messages</span>
            </div>
            <div className="dashboard-hero-rail-value">{messageCount}</div>
          </div>
        </div>
      </section>

      {isEmpty && authToken && (
        <section className="dashboard-bootstrap-shell glass-panel panel-accent">
          <div className="dashboard-bootstrap-copy">
            <div>
              <h2 className="dashboard-bootstrap-title">
                <i className="fa-solid fa-plug text-primary"></i>
                No data yet - connect your sources
              </h2>
              <p className="dashboard-bootstrap-text">
                AcadPulse pulls notifications from WhatsApp groups, Gmail, and Google Classroom.
                Connect at least one source, or load sample data to explore the dashboard.
              </p>
            </div>
            <div className="dashboard-bootstrap-actions">
              <Link to="/integrations/whatsapp" className="btn btn-outline">
                <i className="fa-brands fa-whatsapp"></i> Connect WhatsApp
              </Link>
              <Link to="/integrations/gmail" className="btn btn-outline">
                <i className="fa-solid fa-envelope"></i> Connect Gmail
              </Link>
              <Link to="/integrations/classroom" className="btn btn-outline">
                <i className="fa-brands fa-google"></i> Connect Classroom
              </Link>
              <button className="btn btn-primary" onClick={handleSeedData} disabled={seeding}>
                {seeding
                  ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Loading...</>
                  : <><i className="fa-solid fa-flask"></i> Load Sample Data</>}
              </button>
            </div>
            {seedMsg && (
              <p className={`dashboard-bootstrap-status ${seedMsg.includes('Could') ? 'error' : 'success'}`}>
                <i className={`fa-solid ${seedMsg.includes('Could') ? 'fa-triangle-exclamation' : 'fa-check'}`}></i>
                {seedMsg}
              </p>
            )}
          </div>
        </section>
      )}

      <div className="dashboard-main-grid">
        <section className="dashboard-action-shell glass-panel panel-accent">
          <div className="dashboard-section-header">
            <div className="dashboard-section-title-wrap">
              <div className="dashboard-section-title-icon">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <div>
                <h2 className="dashboard-section-title">Action Required</h2>
                <p className="dashboard-section-subtitle">AI-prioritized tasks for immediate focus</p>
              </div>
            </div>
            <button className="text-btn gradient-link" onClick={() => setIsTasksExpanded(!isTasksExpanded)}>
              {isTasksExpanded ? 'Show Less' : 'View All'}
            </button>
          </div>

          <div className="dashboard-action-body">
            {urgentTasks.length > 0 ? (
              <div className="dashboard-action-list">
                {urgentTasks.map((task) => <TaskCard key={task.id} task={task} />)}
              </div>
            ) : (
              <div className="dashboard-caught-up">
                <div className="dashboard-caught-up-ring">
                  <div className="dashboard-caught-up-ring-core">
                    <i className="fa-solid fa-check"></i>
                  </div>
                </div>
                <div className="dashboard-caught-up-copy">
                  <h3>All caught up!</h3>
                  <p>Great job! You have no pending tasks. Keep up the amazing work.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-stream-shell glass-panel panel-accent">
          <div className="dashboard-section-header">
            <div className="dashboard-section-title-wrap">
              <div className="dashboard-section-title-icon alt">
                <i className="fa-solid fa-bars-staggered"></i>
              </div>
              <div>
                <h2 className="dashboard-section-title">Unified Notification Stream</h2>
                <p className="dashboard-section-subtitle">Live activity from every academic channel</p>
              </div>
            </div>
            <div className="filters glass-pill-group dashboard-stream-filters">
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'All' ? 'active' : ''}`} onClick={() => setActiveFilter('All')}>All</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'WhatsApp' ? 'active' : ''}`} onClick={() => setActiveFilter('WhatsApp')}>WhatsApp</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'Classroom' ? 'active' : ''}`} onClick={() => setActiveFilter('Classroom')}>Classroom</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'Gmail' ? 'active' : ''}`} onClick={() => setActiveFilter('Gmail')}>Gmail</button>
              <button className={`filter-btn glass-filter-pill ${activeFilter === 'Manual' ? 'active' : ''}`} onClick={() => setActiveFilter('Manual')}>Manual</button>
            </div>
          </div>

          <div className="dashboard-stream-list">
            {filteredNotifs.length > 0 ? filteredNotifs.map((notification) => (
              <div className="dashboard-stream-item" key={notification.id} data-source={notification.source}>
                <div className={`dashboard-stream-icon ${notification.source}`}>
                  <i className={`${notification.iconFamily || 'fa-brands'} ${notification.icon}`}></i>
                </div>
                <div className="dashboard-stream-content">
                  <div className="dashboard-stream-head">
                    <span className="dashboard-stream-sender">{notification.sender}</span>
                    <span className={`source-mini-badge ${notification.source}`}>{notification.sourceLabel}</span>
                    {notification.attachmentCount > 0 && (
                      <span className="source-mini-badge neutral">{notification.attachmentCount} file{notification.attachmentCount === 1 ? '' : 's'}</span>
                    )}
                    <span className="dashboard-stream-time">{notification.time}</span>
                  </div>
                  <h4 className="dashboard-stream-title">{notification.title}</h4>
                  <p className="dashboard-stream-preview">{notification.preview}</p>
                  <AttachmentList attachments={notification.attachments} compact />
                </div>
              </div>
            )) : (
              <div className="dashboard-stream-empty">
                <div className="dashboard-stream-empty-icon"><i className="fa-solid fa-inbox"></i></div>
                <p>{activeFilter === 'All' ? 'No notifications yet' : `No ${activeFilter} messages yet`}</p>
                {activeFilter !== 'All' && (
                  <span>Connect {activeFilter} from the Integrations page to see messages here.</span>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dashboard-timetable-shell">
        <ClassScheduleSection
          apiFetch={apiFetch}
          userId={user.id || localStorage.getItem('acadpulse_user_id') || ''}
          title="Dashboard Timetable"
          marginTop={24}
        />
      </div>

      <section className="dashboard-insights-grid">
        <article className="dashboard-insight-panel">
          <span className="dashboard-insight-kicker">Academic Insights</span>
          <strong>{productivityScore}</strong>
          <p>Productivity score shaped by completions and current load.</p>
        </article>
        <article className="dashboard-insight-panel">
          <span className="dashboard-insight-kicker">Weekly Focus</span>
          <strong>{weeklyFocusHours}</strong>
          <p>Suggested focus window for your next study cycle.</p>
        </article>
        <article className="dashboard-insight-panel">
          <span className="dashboard-insight-kicker">Reminder Status</span>
          <strong>{reminderStatus}</strong>
          <p>Smart reminders are monitoring your active academic workload.</p>
        </article>
      </section>
    </div>
  );
}