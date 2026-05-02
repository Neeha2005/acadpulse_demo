import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import TaskCard from '../components/TaskCard';

export default function Dashboard() {
  const { tasks, user, notifications } = useAppContext();
  const [activeFilter, setActiveFilter] = useState('All');
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  
  const firstName = user.fullName ? user.fullName.split(' ')[0] : 'Scholar';

  const filteredNotifs = activeFilter === 'All' 
     ? notifications 
     : notifications.filter(n => n.source.toLowerCase() === activeFilter.toLowerCase());

  const urgentTasks = isTasksExpanded ? tasks : tasks.slice(0, 3);

  return (
    <div className="dashboard-scroll">
      <div className="hero-stats">
        <div className="welcome-text">
          <h1>Welcome back, <span className="accent">{firstName}.</span></h1>
          <p>You have <strong className="text-warning">2 active deadlines</strong> and <strong className="text-warning">5 new messages</strong> across your platforms.</p>
        </div>
      </div>
      
      <div className="stats-grid">
         <div className="stat-card">
            <div className="stat-header">
               <div className="stat-icon bg-urgent-subtle text-urgent" style={{background: 'rgba(249, 65, 68, 0.15)'}}><i className="fa-solid fa-fire"></i></div>
               <div className="stat-trend trend-down" style={{background: 'rgba(67, 170, 139, 0.12)'}}><i className="fa-solid fa-arrow-down"></i> 1 from yesterday</div>
            </div>
            <div className="stat-value">2</div>
            <div className="stat-label">Urgent Deadlines</div>
         </div>
         <div className="stat-card">
            <div className="stat-header">
               <div className="stat-icon bg-primary-subtle text-primary"><i className="fa-solid fa-clock-rotate-left"></i></div>
               <div className="stat-trend trend-up" style={{background: 'rgba(249, 132, 74, 0.12)'}}><i className="fa-solid fa-arrow-up"></i> 12 waiting</div>
            </div>
            <div className="stat-value">4</div>
            <div className="stat-label">Pending Assignments</div>
         </div>
         <div className="stat-card">
            <div className="stat-header">
               <div className="stat-icon bg-whatsapp-subtle text-whatsapp"><i className="fa-brands fa-whatsapp"></i></div>
               <div className="stat-trend neutral">Last sync: 2m ago</div>
            </div>
            <div className="stat-value">15</div>
            <div className="stat-label">Unread Messages</div>
         </div>
      </div>

      <div className="content-grid">
        <div className="panel tasks-panel">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-bolt text-urgent"></i> Action Required</h2>
            <button className="text-btn" onClick={() => setIsTasksExpanded(!isTasksExpanded)}>
                {isTasksExpanded ? 'Show Less' : 'View All'}
            </button>
          </div>
          <div className="tasks-list">
            {urgentTasks.map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        </div>
        
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-bars-staggered text-primary"></i> Unified Notification Stream</h2>
            <div className="filters">
               <button className={`filter-btn ${activeFilter === 'All' ? 'active' : ''}`} onClick={() => setActiveFilter('All')}>All</button>
               <button className={`filter-btn ${activeFilter === 'WhatsApp' ? 'active' : ''}`} onClick={() => setActiveFilter('WhatsApp')}>WhatsApp</button>
               <button className={`filter-btn ${activeFilter === 'Classroom' ? 'active' : ''}`} onClick={() => setActiveFilter('Classroom')}>Classroom</button>
            </div>
          </div>
          <div className="notification-stream" style={{padding: '0 24px 24px'}}>
            {filteredNotifs.map(n => (
               <div className="notif-item" key={n.id}>
                  <div className={`notif-icon-wrap ${n.source}`}><i className={`fa-brands ${n.icon}`}></i></div>
                  <div className="notif-content">
                     <div className="notif-header">
                        <span className="notif-sender">{n.sender}</span>
                        <span className="notif-time">{n.time}</span>
                     </div>
                     <h4 className="notif-title">{n.title}</h4>
                     <p className="notif-preview">{n.preview}</p>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
