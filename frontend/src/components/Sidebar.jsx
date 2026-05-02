import { NavLink } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function Sidebar({ onOpenAccount, collapsed, onToggle }) {
  const { user } = useAppContext();
  const initials = user.fullName ? user.fullName.substring(0, 2).toUpperCase() : "SC";

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <i className="fa-solid fa-graduation-cap logo-icon"></i>
          <span className="logo-text">AcadPulse</span>
        </div>
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <i className={`fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
        </button>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">Main</div>
        <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Dashboard">
          <i className="fa-solid fa-house"></i> <span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/timetable" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Timetable">
          <i className="fa-solid fa-calendar"></i> <span className="nav-label">Timetable</span>
        </NavLink>
        <NavLink to="/courses" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} title="Courses">
          <i className="fa-solid fa-book"></i> <span className="nav-label">Courses</span>
        </NavLink>

        <div className="nav-section">Integrations</div>
        <NavLink to="/integrations/whatsapp" className="nav-item" title="WhatsApp">
          <div className="has-badge" style={{display:'flex', width:'100%'}}>
            <span style={{display: 'flex', alignItems:'center', gap: '12px'}}><i className="fa-brands fa-whatsapp text-whatsapp"></i> <span className="nav-label">WhatsApp</span></span>
            <span className="badge badge-success nav-label">Active</span>
          </div>
        </NavLink>
        <NavLink to="/integrations/classroom" className="nav-item" title="Classroom">
          <div className="has-badge" style={{display:'flex', width:'100%'}}>
            <span style={{display: 'flex', alignItems:'center', gap: '12px'}}><i className="fa-brands fa-google text-warning"></i> <span className="nav-label">Classroom</span></span>
            <span className="badge badge-warning nav-label">Syncing</span>
          </div>
        </NavLink>
        <NavLink to="/integrations/gmail" className="nav-item" title="Gmail">
           <div className="has-badge" style={{display:'flex', width:'100%'}}>
            <span style={{display: 'flex', alignItems:'center', gap: '12px'}}><i className="fa-regular fa-envelope"></i> <span className="nav-label">Gmail</span></span>
            <span className="badge nav-label" style={{background: 'rgba(198, 172, 143, 0.08)'}}>2h ago</span>
          </div>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <div className="user-profile" onClick={onOpenAccount} title="Account Settings">
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
