import { NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

function IntegrationStatusPill({ status }) {
  if (status === 'connected') {
    return <span className="nav-status-pill nav-status-connected nav-label">Connected</span>;
  }
  if (status === 'qr_required') {
    return <span className="nav-status-pill nav-status-qr nav-label">Scan QR</span>;
  }
  if (status === 'disconnected') {
    return <span className="nav-status-pill nav-status-off nav-label">Off</span>;
  }
  return <span className="nav-status-pill status-pill-muted nav-label">-</span>;
}

export default function Sidebar({ onOpenAccount, onOpenSemesterReset, collapsed, onToggle }) {
  const { user, googleConnected, whatsappStatus } = useAppContext();
  const initials = user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'SC';
  const studentMeta = user.university || 'Student';

  const waStatus = whatsappStatus === 'connected' ? 'connected'
    : whatsappStatus === 'qr_required' ? 'qr_required'
    : whatsappStatus === 'open' ? 'connected'
    : 'disconnected';
  const googleStatus = googleConnected ? 'connected' : 'disconnected';

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-wrap">
          <div className="logo-mark">
            <i className="fa-solid fa-graduation-cap logo-icon"></i>
          </div>
          <div className="logo">
            <div className="logo-copy">
              <span className="logo-text gradient-logo">AcadPulse</span>
              <span className="logo-badge">STU</span>
            </div>
            <span className="logo-subtitle">Student Command Center</span>
          </div>
        </div>
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <i className={`fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
        </button>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section nav-section-accent">Main</div>
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Dashboard" data-tooltip="Dashboard">
          <span className="nav-glyph"><i className="fa-solid fa-house"></i></span> <span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/assignments" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Assignments" data-tooltip="Assignments">
          <span className="nav-glyph"><i className="fa-solid fa-list-check"></i></span> <span className="nav-label">Assignments</span>
        </NavLink>
        <NavLink to="/events" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Events" data-tooltip="Events">
          <span className="nav-glyph"><i className="fa-solid fa-calendar-days"></i></span> <span className="nav-label">Events</span>
        </NavLink>
        <NavLink to="/announcements" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Announcements" data-tooltip="Announcements">
          <span className="nav-glyph"><i className="fa-solid fa-bullhorn"></i></span> <span className="nav-label">Announcements</span>
        </NavLink>
        <NavLink to="/materials" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Materials" data-tooltip="Materials">
          <span className="nav-glyph"><i className="fa-solid fa-folder-open"></i></span> <span className="nav-label">Materials</span>
        </NavLink>
        <NavLink to="/timetable" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Timetable" data-tooltip="Timetable">
          <span className="nav-glyph"><i className="fa-solid fa-calendar"></i></span> <span className="nav-label">Timetable</span>
        </NavLink>
        <NavLink to="/courses" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Courses" data-tooltip="Courses">
          <span className="nav-glyph"><i className="fa-solid fa-book"></i></span> <span className="nav-label">Courses</span>
        </NavLink>
        <NavLink to="/onboarding" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Onboarding" data-tooltip="Onboarding">
          <span className="nav-glyph"><i className="fa-solid fa-compass"></i></span> <span className="nav-label">Onboarding</span>
        </NavLink>

        <div className="sidebar-divider"></div>
        <div className="nav-section nav-section-accent">Integrations</div>
        <NavLink to="/integrations/whatsapp" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="WhatsApp" data-tooltip="WhatsApp">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-whatsapp"><i className="fa-brands fa-whatsapp"></i></span>
              <span className="nav-label">WhatsApp</span>
            </span>
            <IntegrationStatusPill status={waStatus} />
          </div>
        </NavLink>
        <NavLink to="/integrations/classroom" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Classroom" data-tooltip="Classroom">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-classroom"><i className="fa-brands fa-google"></i></span>
              <span className="nav-label">Classroom</span>
            </span>
            <IntegrationStatusPill status={googleStatus} />
          </div>
        </NavLink>
        <NavLink to="/integrations/gmail" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Gmail" data-tooltip="Gmail">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-gmail"><i className="fa-regular fa-envelope"></i></span>
              <span className="nav-label">Gmail</span>
            </span>
            <IntegrationStatusPill status={googleStatus} />
          </div>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button className="semester-reset-link nav-label" type="button" onClick={onOpenSemesterReset} data-tooltip="New Semester">
          <span className="semester-reset-icon"><i className="fa-solid fa-rotate-left"></i></span>
          <span className="semester-reset-text">New Semester</span>
        </button>
        <div className="user-profile profile-glass" onClick={onOpenAccount} title="Account Settings" data-tooltip="Account Settings">
          <div className="avatar">{initials}</div>
          <div className="user-info nav-label">
            <div className="user-name">{user.fullName}</div>
            <div className="user-role">{studentMeta}</div>
            <div className="status-indicator"><div className="dot online"></div> Online</div>
          </div>
          <div className="user-profile-chevron"><i className="fa-solid fa-chevron-up"></i></div>
        </div>
      </div>
    </div>
  );
}
