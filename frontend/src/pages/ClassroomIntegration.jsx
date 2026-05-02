import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function ClassroomIntegration() {
  const { notifications, tasks } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);
  const [oauthStatus, setOauthStatus] = useState(true);
  const [autoExtractEnabled, setAutoExtractEnabled] = useState(true);

  // Filter Classroom specific Context array instances
  const classroomNotifs = notifications.filter(n => n.source === 'classroom');
  const classroomTasks = tasks.filter(t => t.source === 'classroom');

  const handleForceSync = () => {
    setIsSyncing(true);
    console.log("[API MOCK TETHER] POST backend.com/api/integrations/classroom/sync");
    setTimeout(() => {
        setIsSyncing(false);
    }, 1800);
  }

  const handleOAuth = () => {
    console.log("[API MOCK TETHER] GET backend.com/api/auth/google");
    setOauthStatus(!oauthStatus);
  }

  return (
    <div className="dashboard-scroll">
      <div className="hero-stats" style={{paddingBottom: 24, borderBottom: '1px solid var(--border)'}}>
        <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
           <div style={{width: 64, height: 64, borderRadius: 16, background: 'var(--warning-subtle)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32}}>
              <i className="fa-brands fa-google"></i>
           </div>
           <div>
              <h1 style={{margin: '0 0 8px 0'}}>Google Classroom Interface</h1>
              <p style={{margin: 0, color: 'var(--text-muted)'}}>Manage your OAuth credentials, API polling loops, and automatic GUI task generation.</p>
           </div>
           <div style={{marginLeft: 'auto', display: 'flex', gap: 16}}>
               <button className="btn btn-outline" onClick={handleOAuth}>
                  {oauthStatus ? 'Revoke Local Access' : 'Authenticate Google OAuth'}
               </button>
               <button className="btn btn-primary" onClick={handleForceSync} disabled={isSyncing || !oauthStatus}>
                  {isSyncing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Polling Google API...</> : 'Force Fast Sync'}
               </button>
           </div>
        </div>
      </div>
      
      <div className="content-grid" style={{marginTop: 32}}>
         <div className="panel tasks-panel">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-sliders text-warning"></i> API Pipeline Automation</h2>
            </div>
            <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 24}}>
               {!oauthStatus && (
                 <div style={{color: 'var(--warning)', padding: 12, background: 'var(--warning-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning)', fontSize: 14}}>
                    <i className="fa-solid fa-triangle-exclamation"></i> Classroom API is Disconnected. You must authenticate via Google OAuth protocol.
                 </div>
               )}

               <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center'}}>
                   <div>
                      <strong style={{display: 'block', fontSize: 14, marginBottom: 4}}>Automatic Task Extraction Protocol</strong>
                      <span style={{fontSize: 13, color: 'var(--text-muted)'}}>Instantly parse global announcements locally and inject into the active task queue.</span>
                   </div>
                   <div onClick={() => oauthStatus && setAutoExtractEnabled(!autoExtractEnabled)} style={{width: 44, height: 24, borderRadius: 12, background: (oauthStatus && autoExtractEnabled) ? 'var(--warning)' : 'var(--bg)', border: '1px solid var(--border-strong)', position: 'relative', cursor: oauthStatus ? 'pointer' : 'not-allowed', transition: 'all 0.3s ease', opacity: oauthStatus ? 1 : 0.5}}>
                      <div style={{width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 1, left: (oauthStatus && autoExtractEnabled) ? 20 : 2, transition: 'all 0.3s ease'}}></div>
                   </div>
               </div>
               
               <div style={{padding: 16, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)'}}>
                  <strong style={{color: 'var(--text-faint)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8}}>Current Authenticated Target Subject</strong>
                  <code style={{fontSize: 13, color: oauthStatus ? 'var(--text-muted)' : 'var(--urgent)', fontFamily: 'monospace'}}>student@university.edu ({oauthStatus ? 'Access Valid' : 'Token Terminated'})</code>
               </div>

               <div style={{display: 'flex', justifyContent: 'space-between', background: 'var(--surface-hover)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'}}>
                  <div>
                    <strong style={{fontSize: 32, display: 'block', color: 'var(--warning)'}}>{classroomTasks.length}</strong>
                    <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Active Tasks Extracted</span>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <strong style={{fontSize: 32, display: 'block', color: 'var(--text)'}}>{classroomNotifs.length}</strong>
                    <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Unread Announcements</span>
                  </div>
               </div>
            </div>
         </div>
         
         <div className="panel">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-graduation-cap text-warning"></i> Classroom Polling Logs</h2>
               <span className="badge badge-warning">{classroomNotifs.length} items queued</span>
            </div>
            <div className="notification-stream" style={{padding: '0 24px 24px'}}>
            {!oauthStatus ? (
               <div style={{color: 'var(--urgent)', padding: 16, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 14}}>
                  <strong>WARNING:</strong> Missing global OAuth Tokens. Target stream unavailable.
               </div>
            ) : classroomNotifs.length === 0 ? (
                <div style={{color: 'var(--text-muted)', fontSize: 13}}>No recent data from this vector.</div>
            ) : (
                classroomNotifs.map(n => (
                   <div className="notif-item" key={n.id}>
                      <div className="notif-icon-wrap classroom" style={{background: 'var(--surface-hover)', color: 'var(--warning)'}}>
                        <i className="fa-brands fa-google"></i>
                      </div>
                      <div className="notif-content">
                         <div className="notif-header">
                            <span className="notif-sender">{n.sender}</span>
                            <span className="notif-time">{n.time}</span>
                         </div>
                         <h4 className="notif-title">{n.title}</h4>
                         <p className="notif-preview">{n.preview}</p>
                      </div>
                   </div>
                ))
            )}
            </div>
         </div>
      </div>
    </div>
  )
}
