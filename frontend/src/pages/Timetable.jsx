import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function Timetable() {
  const [view, setView] = useState('week');
  const { tasks, setActiveTaskModal } = useAppContext();

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  // Distributing tasks pseudo-dynamically across the arrays just for GUI flow
  const weekMapping = days.map((day, dIdx) => ({
    name: day,
    items: tasks.filter((_, tIdx) => tIdx % 5 === dIdx)
  }));

  const monthMapping = Array.from({length: 31}).map((_, mIdx) => ({
    dayNum: mIdx + 1,
    items: tasks.filter((_, tIdx) => tIdx % 31 === mIdx)
  }));

  const getTaskBorderColor = (task) => {
    if (task.urgency === 'urgent') return 'var(--urgent)';
    if (task.source === 'whatsapp') return 'var(--whatsapp)';
    if (task.source === 'classroom') return 'var(--warning)';
    if (task.source === 'gmail') return 'var(--urgent)';
    return 'var(--primary)';
  };

  return (
    <div className="dashboard-scroll">
      <div className="hero-stats">
        <div className="welcome-text">
          <h1>Master Timetable</h1>
          <p>Your comprehensive scheduling view powered by your integrations.</p>
        </div>
      </div>
      
      <div className="panel" style={{marginTop: 32}}>
        <div className="panel-header" style={{borderBottom: '1px solid var(--border)', paddingBottom: 16}}>
          <h2 className="panel-title"><i className="fa-regular fa-calendar text-primary"></i> Expected Schedule Map</h2>
          <div className="filters">
            <button className={`filter-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>This Week</button>
            <button className={`filter-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month Overview</button>
          </div>
        </div>
        
        <div className="modal-body" style={{ minHeight: 400, padding: view === 'week' ? '24px 0 0 0' : '24px' }}>
           {view === 'week' ? (
              <div style={{display: 'flex', gap: 16, height: '100%', padding: '0 24px'}}>
                 {weekMapping.map((dayBlock, i) => (
                    <div key={dayBlock.name} style={{flex: 1, borderTop: dayBlock.items.length > 0 ? '3px solid var(--primary)' : '3px solid var(--border)', paddingTop: 16, background: dayBlock.items.length > 0 ? 'var(--surface-hover)' : 'transparent', borderRadius: '8px 8px 0 0', padding: dayBlock.items.length > 0 ? '16px 12px' : '16px 0'}}>
                       <h3 style={{fontSize: 14, color: dayBlock.items.length > 0 ? 'var(--primary)' : 'var(--text-muted)', textAlign: 'center', marginBottom: 24, textTransform: 'uppercase'}}>{dayBlock.name}</h3>
                       
                       {dayBlock.items.map(task => (
                          <div key={task.id} 
                               onClick={() => setActiveTaskModal(task)}
                               title="Click to view full overlay"
                               style={{background: 'rgba(0,0,0,0.3)', cursor: 'pointer', borderLeft: task.urgency === 'urgent' ? '4px solid var(--urgent)' : '4px solid var(--primary)', padding: 12, borderRadius: 4, marginBottom: 12, transition: 'all 0.2s ease'}}>
                             <span style={{fontSize: 11, color: task.urgency === 'urgent' ? 'var(--urgent)' : 'var(--primary)', fontWeight: 'bold'}}>{task.due || 'All Day'}</span>
                             <h4 style={{fontSize: 13, margin: '4px 0 0', color: 'var(--text)'}}>{task.title}</h4>
                             <p style={{fontSize: 11, color: 'var(--text-muted)', margin: 0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{task.course}</p>
                          </div>
                       ))}
                    </div>
                 ))}
              </div>
           ) : (
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px'}}>
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8, textTransform: 'uppercase', fontWeight: 'bold'}}>{d}</div>
                 ))}
                 {monthMapping.map((block) => {
                    return (
                    <div key={block.dayNum} style={{
                        minHeight: 100, 
                        background: block.items.length > 0 ? 'var(--primary-subtle)' : 'var(--surface-hover)', 
                        border: block.items.length > 0 ? '1px solid var(--primary)' : '1px solid var(--border)', 
                        borderRadius: 8, 
                        padding: 10, 
                        display: 'flex', 
                        flexDirection: 'column',
                        transition: 'all 0.2s ease'
                    }}>
                       <span style={{fontSize: 13, color: block.items.length > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold', marginBottom: 8}}>{block.dayNum}</span>
                       <div style={{display: 'flex', flexDirection: 'column', gap: 6, flex: 1}}>
                         {block.items.map(task => {
                           const borderColor = getTaskBorderColor(task);
                           return (
                             <div key={task.id}
                                  onClick={() => setActiveTaskModal(task)}
                                  title={`${task.title} — ${task.course}\nDue: ${task.due || 'All Day'}`}
                                  style={{
                                    background: 'rgba(0,0,0,0.35)',
                                    borderLeft: `3px solid ${borderColor}`,
                                    borderRadius: 4,
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.55)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.35)'}
                             >
                               <span style={{fontSize: 10, color: borderColor, fontWeight: 'bold', display: 'block', marginBottom: 2}}>{task.due || 'All Day'}</span>
                               <h4 style={{fontSize: 11, margin: 0, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{task.title}</h4>
                               <p style={{fontSize: 10, margin: '2px 0 0', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{task.course}</p>
                             </div>
                           );
                         })}
                       </div>
                    </div>
                    );
                 })}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
