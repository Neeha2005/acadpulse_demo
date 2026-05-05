import { NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function Sidebar({ onOpenAccount, onOpenChatbot, onOpenSemesterReset, chatbotOpen, collapsed, onToggle }) {
  const { user } = useAppContext();
  const initials = user.fullName ? user.fullName.substring(0, 2).toUpperCase() : "SC";

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-wrap">
          <div className="logo-mark">
            <i className="fa-solid fa-graduation-cap logo-icon"></i>
          </div>
          <div className="logo">
            <span className="logo-text gradient-logo">AcadPulse</span>
            <span className="logo-subtitle">Student Command Center</span>
          </div>
        </div>
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <i className={`fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
        </button>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section nav-section-accent">Main</div>
        <NavLink to="/dashboard" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Dashboard">
          <i className="fa-solid fa-house"></i> <span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/assignments" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Assignments">
          <i className="fa-solid fa-list-check"></i> <span className="nav-label">Assignments</span>
        </NavLink>
        <NavLink to="/events" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Events">
          <i className="fa-solid fa-calendar-days"></i> <span className="nav-label">Events</span>
        </NavLink>
        <NavLink to="/announcements" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Announcements">
          <i className="fa-solid fa-bullhorn"></i> <span className="nav-label">Announcements</span>
        </NavLink>
        <NavLink to="/materials" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Materials">
          <i className="fa-solid fa-folder-open"></i> <span className="nav-label">Materials</span>
        </NavLink>
        <NavLink to="/timetable" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Timetable">
          <i className="fa-solid fa-calendar"></i> <span className="nav-label">Timetable</span>
        </NavLink>
        <NavLink to="/courses" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Courses">
          <i className="fa-solid fa-book"></i> <span className="nav-label">Courses</span>
        </NavLink>
        <button
          className={`nav-item nav-button chat-nav-trigger ${chatbotOpen ? 'chat-open' : ''}`}
          type="button"
          title="Chatbot"
          onClick={onOpenChatbot}
        >
          <i className="fa-solid fa-comments"></i> <span className="nav-label">Chatbot</span>
        </button>
        <NavLink to="/onboarding" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Onboarding">
          <i className="fa-solid fa-compass"></i> <span className="nav-label">Onboarding</span>
        </NavLink>

        <div className="sidebar-divider"></div>
        <div className="nav-section nav-section-accent">Integrations</div>
        <NavLink to="/integrations/whatsapp" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="WhatsApp">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-whatsapp"><i className="fa-brands fa-whatsapp"></i></span>
              <span className="nav-label">WhatsApp</span>
            </span>
            <span className="nav-status-pill status-pill-unknown nav-label">unknown</span>
          </div>
        </NavLink>
        <NavLink to="/integrations/classroom" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Classroom">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-classroom"><i className="fa-brands fa-google"></i></span>
              <span className="nav-label">Classroom</span>
            </span>
            <span className="nav-status-pill status-pill-syncing nav-label">
              <span className="status-badge-spinner"></span>
              Syncing
            </span>
          </div>
        </NavLink>
        <NavLink to="/integrations/gmail" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Gmail">
           <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-gmail"><i className="fa-regular fa-envelope"></i></span>
              <span className="nav-label">Gmail</span>
            </span>
            <span className="nav-status-pill status-pill-muted nav-label">2h ago</span>
          </div>
        </NavLink>

        <div className="sidebar-divider"></div>
        <div className="nav-section nav-section-accent">History</div>
        <NavLink to="/archives" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Archives">
          <i className="fa-solid fa-box-archive"></i> <span className="nav-label">Archives</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button className="semester-reset-link nav-label" type="button" onClick={onOpenSemesterReset}>
          New Semester
        </button>
        <div className="user-profile profile-glass" onClick={onOpenAccount} title="Account Settings">
          <div className="avatar">{initials}</div>
          <div className="user-info nav-label">
            <div className="user-name">{user.fullName}</div>
            <div className="status-indicator"><div className="dot online"></div> Online</div>
          </div>
        </div>
      </div>
    </div>
  )
}
