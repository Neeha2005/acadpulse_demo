import React from 'react';
import { useAppContext } from '../context/AppContext';

export default function SearchDropdown({ query, onSelect }) {
  const { tasks, notifications, setActiveTaskModal } = useAppContext();
  
  if (!query) return null;

  const lowerQuery = query.toLowerCase();

  // Filter Tasks
  const matchedTasks = tasks.filter(t => 
    (t.title && t.title.toLowerCase().includes(lowerQuery)) || 
    (t.course && t.course.toLowerCase().includes(lowerQuery)) ||
    (t.content && t.content.toLowerCase().includes(lowerQuery))
  ).map(t => {
    let colorCls = '';
    if(t.source === 'whatsapp') colorCls = 'text-whatsapp';
    else if(t.source === 'classroom') colorCls = 'text-warning';
    else if(t.source === 'gmail') colorCls = 'text-urgent';
    else colorCls = 'text-primary';
    
    let iconFormat = (t.source === 'gmail' || t.source === 'manual') ? 'fa-solid' : 'fa-brands';

    return {
      id: `task_${t.id}`,
      type: 'task',
      rawTask: t,
      title: t.title,
      subtitle: `Task Match • ${t.course}`,
      iconClass: `${iconFormat} ${t.icon} ${colorCls}`
    };
  });

  // Filter Notifications
  const matchedNotifs = notifications.filter(n => 
    (n.title && n.title.toLowerCase().includes(lowerQuery)) || 
    (n.sender && n.sender.toLowerCase().includes(lowerQuery)) ||
    (n.preview && n.preview.toLowerCase().includes(lowerQuery))
  ).map(n => {
    let colorCls = '';
    if(n.source === 'whatsapp') colorCls = 'text-whatsapp';
    else if(n.source === 'classroom') colorCls = 'text-warning';
    else if(n.source === 'gmail') colorCls = 'text-urgent';
    else colorCls = 'text-primary';

    return {
      id: `notif_${n.id}`,
      type: 'notification',
      rawNotif: n,
      title: n.title,
      subtitle: `Notification Match • ${n.sender}`,
      iconClass: `fa-brands ${n.icon} ${colorCls}`
    };
  });

  const allMatches = [...matchedTasks, ...matchedNotifs].slice(0, 5); // Limit dropdown noise

  const handleResultClick = (match) => {
    if (match.type === 'task') {
       setActiveTaskModal(match.rawTask);
    }
    // Custom mapping for notifications route goes here when user requests it! 
    
    if (onSelect) onSelect();
  }

  return (
    <div className="search-dropdown show">
      <div className="search-drop-list">
         {allMatches.length === 0 ? (
            <div style={{padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13}}>
                No resources mapped natively for "{query}"
            </div>
         ) : (
            allMatches.map(match => (
              <div className="search-result-item" key={match.id} onClick={() => handleResultClick(match)}>
                  <div className="icon" style={{background: 'var(--surface-hover)'}}>
                      <i className={match.iconClass}></i>
                  </div>
                  <div className="content" style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                     <h4 style={{fontSize: 13, margin: '0 0 4px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px'}}>{match.title}</h4>
                     <p style={{fontSize: 11, margin: 0, color: 'var(--text-muted)'}}>{match.subtitle}</p>
                  </div>
              </div>
            ))
         )}
      </div>
      {allMatches.length > 0 && <div className="search-status">Press Enter to perform global search execution</div>}
    </div>
  );
}
