import { useState } from 'react';
import SearchDropdown from './SearchDropdown';
import { useAppContext } from '../context/AppContext';

export default function Topbar({ onOpenAddTask }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const { notifications } = useAppContext();

  const reloadSync = () => {
    setIsSyncing(true);
    console.log('[API MOCK TETHER] POST backend.com/api/sync/global');
    setTimeout(() => {
        setIsSyncing(false);
    }, 1000);
  }

  return (
    <div className="topbar glass-topbar">
      <div className="search-wrap glass-input-wrap">
        <i className="fa-solid fa-search topbar-search-icon"></i>
        <input 
            type="text" 
            placeholder="Search assignments, messages, or materials..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
        />
        <SearchDropdown query={searchQuery} onSelect={() => setSearchQuery('')} />
      </div>
      <div className="topbar-actions">
        <button className="icon-btn glass-icon-btn topbar-icon-btn" title="Sync integrations" onClick={reloadSync} disabled={isSyncing}>
          <i className={`fa-solid fa-rotate-right ${isSyncing ? 'fa-spin text-primary' : ''}`}></i>
        </button>
        <div className="topbar-wrapper">
          <button 
             className={`icon-btn glass-icon-btn topbar-icon-btn ${notifications.length > 0 ? 'active-notif' : ''}`} 
             title="Notifications" 
             onClick={() => setShowNotifs(!showNotifs)}
          >
             <i className="fa-regular fa-bell"></i>
             {notifications.length > 0 && <span className="pip bell-pip"></span>}
          </button>
          
          <div className={`notif-dropdown ${showNotifs ? 'show' : ''}`}>
             <div className="notif-drop-header">
                <h3>Notifications</h3>
                <span className="badge badge-muted">{notifications.length} New</span>
             </div>
             <div className="notif-drop-list">
                {notifications.map(n => (
                   <div className="notif-drop-item" key={n.id}>
                      <div className={`nd-icon ${n.source}`}>
                         <i className={`${n.iconFamily || 'fa-brands'} ${n.icon}`}></i>
                      </div>
                      <div className="nd-content">
                         <h4>{n.sender}</h4>
                         <p>{n.title}</p>
                         <span>{n.time}</span>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
        <button className="btn btn-primary topbar-cta" onClick={onOpenAddTask}>
            <i className="fa-solid fa-plus"></i> Add Manual Task
        </button>
      </div>
    </div>
  )
}
