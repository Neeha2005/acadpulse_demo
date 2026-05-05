import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import TaskCard from '../components/TaskCard';

export default function Dashboard() {
  const { tasks, user, notifications } = useAppContext();
  const [activeFilter, setActiveFilter] = useState('All');
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  
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

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="hero-orb"></div>
        <div className="welcome-text">
          <span className="hero-kicker">STUDENT OPERATIONS</span>
          <h1 className="hero-title">Welcome back, <span className="accent">{firstName}</span>.</h1>
          <p>
            You have <strong className="text-warning">{urgentCount} active deadlines</strong>,
            <strong className="text-warning"> {risingCount} items rising</strong>, and
            <strong className="text-warning"> {messageCount} live notifications</strong>.
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
         <div className="stat-card glass-card">
            <div className="stat-header">
               <div className="stat-icon stat-icon-messages"><i className="fa-brands fa-whatsapp"></i></div>
               <div className="stat-trend trend-pill trend-pill-messages">Live backend feed</div>
            </div>
            <div className="stat-value stat-value-messages">{messageCount}</div>
            <div className="stat-label">Unread Messages</div>
         </div>
      </div>

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
                <p>Nothing here yet</p>
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
          <div className="notification-stream" style={{padding: '0 24px 24px'}}>
            {filteredNotifs.length > 0 ? filteredNotifs.map(n => (
               <div className="notif-item" key={n.id}>
                  <div className={`notif-icon-wrap ${n.source}`}><i className={`${n.iconFamily || 'fa-brands'} ${n.icon}`}></i></div>
                  <div className="notif-content">
                     <div className="notif-header">
                        <span className="notif-sender">{n.sender}</span>
                        <span className={`source-mini-badge ${n.source}`}>{n.sourceLabel}</span>
                        <span className="notif-time">{n.time}</span>
                     </div>
                     <h4 className="notif-title">{n.title}</h4>
                     <p className="notif-preview">{n.preview}</p>
                  </div>
               </div>
            )) : (
              <div className="empty-state glass-empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-inbox"></i></div>
                <p>Nothing here yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
