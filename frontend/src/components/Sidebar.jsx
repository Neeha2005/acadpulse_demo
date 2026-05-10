import { NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import gmailLogo from '../assets/google-gmail-svgrepo-com.svg';

function AppLogo({ app }) {
  if (app === 'whatsapp') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" className="app-logo-svg">
        <path fill="#25D366" d="M16 3.2c-7.07 0-12.8 5.58-12.8 12.47 0 2.4.71 4.63 1.93 6.52L3.2 28.8l6.88-1.8a13.06 13.06 0 0 0 5.92 1.41c7.07 0 12.8-5.58 12.8-12.47S23.07 3.2 16 3.2Z"/>
        <path fill="#FFF" d="M22.2 18.63c-.34-.17-2-.98-2.31-1.1-.31-.11-.54-.17-.77.17-.23.34-.88 1.1-1.08 1.32-.2.23-.4.25-.74.08-.34-.17-1.46-.53-2.78-1.69-1.03-.91-1.73-2.02-1.93-2.36-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.08-.17-.77-1.8-1.06-2.46-.28-.67-.56-.57-.77-.58h-.66c-.23 0-.6.08-.91.43-.31.34-1.2 1.16-1.2 2.84s1.23 3.3 1.4 3.53c.17.23 2.42 3.83 5.98 5.22.85.33 1.5.52 2.02.67.85.24 1.63.2 2.24.12.68-.1 2-.82 2.28-1.6.28-.79.28-1.46.2-1.6-.08-.14-.31-.23-.65-.4Z"/>
      </svg>
    );
  }

  if (app === 'classroom') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true" className="app-logo-svg">
        <rect x="3" y="5" width="26" height="22" rx="4.5" fill="#0F9D58"/>
        <rect x="6.5" y="8.5" width="19" height="15" rx="2.5" fill="#F4B400"/>
        <circle cx="16" cy="15" r="3.2" fill="#FFF"/>
        <path fill="#FFF" d="M10.6 21.2c.58-2.15 2.7-3.7 5.4-3.7s4.82 1.55 5.4 3.7H10.6Z"/>
        <circle cx="10.8" cy="15.5" r="1.55" fill="#E8F0FE"/>
        <circle cx="21.2" cy="15.5" r="1.55" fill="#E8F0FE"/>
      </svg>
    );
  }

  if (app === 'gmail') {
    return (
      <img src={gmailLogo} alt="" aria-hidden="true" className="app-logo-svg" />
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="app-logo-svg">
      <path fill="#EA4335" d="M28.8 9.68H16v4.96h7.35c-.64 3.18-3.34 4.96-7.35 4.96-4.47 0-8.1-3.63-8.1-8.1s3.63-8.1 8.1-8.1c2.01 0 3.83.74 5.22 1.95l3.77-3.77A13.37 13.37 0 0 0 16 0C7.16 0 0 7.16 0 16s7.16 16 16 16c9.24 0 15.33-6.5 15.33-15.65 0-1.05-.1-1.81-.23-2.67Z"/>
      <path fill="#34A853" d="M1.84 7.06 5.9 10.04A9.57 9.57 0 0 1 16 3.4c2.01 0 3.83.74 5.22 1.95l3.77-3.77A15.35 15.35 0 0 0 16 0C9.86 0 4.54 3.5 1.84 7.06Z"/>
      <path fill="#FBBC05" d="M0 16c0 2.57.76 4.96 2.06 6.96l4.66-3.6A9.49 9.49 0 0 1 5.9 16c0-1.19.22-2.33.62-3.36L1.84 7.06A15.89 15.89 0 0 0 0 16Z"/>
      <path fill="#4285F4" d="M16 32c4.14 0 7.62-1.36 10.16-3.68l-4.7-3.63c-1.3.9-2.98 1.43-5.46 1.43-3.92 0-7.24-2.65-8.43-6.22l-4.63 3.57C5.58 28.28 10.3 32 16 32Z"/>
    </svg>
  );
}

function IntegrationStatusPill({ status }) {
  if (status === 'connected') {
    return <span className="nav-status-pill nav-status-connected nav-label" aria-label="Connected" title="Connected"><i className="fa-solid fa-check"></i></span>;
  }
  if (status === 'qr_required') {
    return <span className="nav-status-pill nav-status-qr nav-label" aria-label="Scan QR" title="Scan QR"><i className="fa-solid fa-qrcode"></i></span>;
  }
  if (status === 'disconnected') {
    return <span className="nav-status-pill nav-status-off nav-label" aria-label="Off" title="Off"><i className="fa-solid fa-xmark"></i></span>;
  }
  return <span className="nav-status-pill status-pill-muted nav-label" aria-label="Unknown" title="Unknown"><i className="fa-solid fa-minus"></i></span>;
}

function MainNavIcon({ item }) {
  if (item === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-main-icon">
        <rect x="3" y="3" width="8" height="8" rx="2.2" fill="currentColor" opacity="0.96" />
        <rect x="13" y="3" width="8" height="5.6" rx="2" fill="currentColor" opacity="0.78" />
        <rect x="13" y="10.6" width="8" height="10.4" rx="2.2" fill="currentColor" opacity="0.96" />
        <rect x="3" y="13" width="8" height="8" rx="2.2" fill="currentColor" opacity="0.72" />
      </svg>
    );
  }

  if (item === 'assignments') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-main-icon">
        <rect x="5" y="3.5" width="14" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M8 8.3h8M8 12h5.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <path d="m8.1 16.2 1.7 1.7 3.7-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (item === 'events') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-main-icon">
        <rect x="3.5" y="5.5" width="17" height="14.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M7.5 3.8v3.4M16.5 3.8v3.4M3.9 9.2h16.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="8.4" cy="13.2" r="1.2" fill="currentColor" />
        <circle cx="12" cy="13.2" r="1.2" fill="currentColor" opacity="0.82" />
        <circle cx="15.6" cy="13.2" r="1.2" fill="currentColor" opacity="0.66" />
      </svg>
    );
  }

  if (item === 'announcements') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-main-icon">
        <path d="M5 10.2c0-1.1.7-2.1 1.8-2.4l9.1-2.8c1.2-.4 2.5.5 2.5 1.8v9.5c0 1.3-1.3 2.2-2.5 1.8l-9.1-2.8A2.5 2.5 0 0 1 5 12.8v-2.6Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        <path d="M8.2 15.6 9.4 19a1.9 1.9 0 0 0 2.4 1.1l.8-.3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  if (item === 'materials') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-main-icon">
        <path d="M4.2 7.2a2.7 2.7 0 0 1 2.7-2.7h3.8l1.8 2h4.6a2.7 2.7 0 0 1 2.7 2.7v7.9a2.7 2.7 0 0 1-2.7 2.7H6.9a2.7 2.7 0 0 1-2.7-2.7V7.2Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        <path d="M4.8 10h14.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  if (item === 'timetable') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-main-icon">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M12 7.6v4.7l3.1 1.9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-main-icon">
      <path d="M6.2 6.2h8.9a2.4 2.4 0 0 1 2.4 2.4v9.2a2.1 2.1 0 0 1-2.1 2.1H8.7a2.5 2.5 0 0 1-2.5-2.5V6.2Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M8.8 4.4h8.1a2.1 2.1 0 0 1 2.1 2.1V16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
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
            </div>
          </div>
        </div>
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <i className={`fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
        </button>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section nav-section-accent">Main</div>
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Dashboard" data-tooltip="Dashboard">
          <span className="nav-glyph"><MainNavIcon item="dashboard" /></span> <span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/assignments" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Assignments" data-tooltip="Assignments">
          <span className="nav-glyph"><MainNavIcon item="assignments" /></span> <span className="nav-label">Assignments</span>
        </NavLink>
        <NavLink to="/events" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Events" data-tooltip="Events">
          <span className="nav-glyph"><MainNavIcon item="events" /></span> <span className="nav-label">Events</span>
        </NavLink>
        <NavLink to="/announcements" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Announcements" data-tooltip="Announcements">
          <span className="nav-glyph"><MainNavIcon item="announcements" /></span> <span className="nav-label">Announcements</span>
        </NavLink>
        <NavLink to="/materials" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Materials" data-tooltip="Materials">
          <span className="nav-glyph"><MainNavIcon item="materials" /></span> <span className="nav-label">Materials</span>
        </NavLink>
        <NavLink to="/timetable" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Timetable" data-tooltip="Timetable">
          <span className="nav-glyph"><MainNavIcon item="timetable" /></span> <span className="nav-label">Timetable</span>
        </NavLink>
        <NavLink to="/courses" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Courses" data-tooltip="Courses">
          <span className="nav-glyph"><MainNavIcon item="courses" /></span> <span className="nav-label">Courses</span>
        </NavLink>
        <div className="sidebar-divider"></div>
        <div className="nav-section nav-section-accent">Integrations</div>
        <NavLink to="/integrations/whatsapp" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="WhatsApp" data-tooltip="WhatsApp">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-whatsapp"><AppLogo app="whatsapp" /></span>
              <span className="nav-label">WhatsApp</span>
            </span>
            <IntegrationStatusPill status={waStatus} />
          </div>
        </NavLink>
        <NavLink to="/integrations/classroom" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Classroom" data-tooltip="Classroom">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-classroom"><AppLogo app="classroom" /></span>
              <span className="nav-label">Classroom</span>
            </span>
            <IntegrationStatusPill status={googleStatus} />
          </div>
        </NavLink>
        <NavLink to="/integrations/gmail" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Gmail" data-tooltip="Gmail">
          <div className="has-badge nav-badge-row">
            <span className="nav-icon-label">
              <span className="nav-icon-glass nav-icon-gmail"><AppLogo app="gmail" /></span>
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
