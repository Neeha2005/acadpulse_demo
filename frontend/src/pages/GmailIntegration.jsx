import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function GmailIntegration() {
  const { notifications, tasks } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);
  const [imapStatus, setImapStatus] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState(true);

  // Filter Gmail specific Context array instances
  const gmailNotifs = notifications.filter(n => n.source === 'gmail');
  const gmailTasks = tasks.filter(t => t.source === 'gmail');

  const handleForceSync = () => {
    setIsSyncing(true);
    console.log("[API MOCK TETHER] POST backend.com/api/integrations/gmail/sync");
    setTimeout(() => {
        setIsSyncing(false);
    }, 2000);
  }

  const handleImapConnection = () => {
    console.log("[API MOCK TETHER] POST backend.com/api/auth/imap/toggle");
    setImapStatus(!imapStatus);
  }

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
           <div style={{width: 64, height: 64, borderRadius: 16, background: 'var(--urgent-subtle)', color: 'var(--urgent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32}}>
              <i className="fa-regular fa-envelope"></i>
           </div>
           <div>
              <h1 style={{margin: '0 0 8px 0'}}>Gmail Integration</h1>
              <p style={{margin: 0, color: 'var(--text-muted)'}}>Manage IMAP threading, Professor email NLP extraction, and Priority Inbox rules.</p>
           </div>
           <div style={{marginLeft: 'auto', display: 'flex', gap: 16}}>
               <button className="btn btn-outline" onClick={handleImapConnection}>
                  {imapStatus ? 'Disconnect OAuth/IMAP' : 'Re-Authenticate'}
               </button>
               <button className="btn btn-primary" onClick={handleForceSync} disabled={isSyncing || !imapStatus}>
                  {isSyncing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Polling Inbox...</> : 'Force Inbox Sync'}
               </button>
           </div>
        </div>
      </section>
      
      <div className="content-grid" style={{marginTop: 32}}>
         <div className="panel tasks-panel glass-panel panel-accent">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-sliders text-urgent"></i> Inbox Processing Rules</h2>
            </div>
            <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 24}}>
               {!imapStatus && (
                 <div style={{color: 'var(--urgent)', padding: 12, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 14}}>
                    <i className="fa-solid fa-triangle-exclamation"></i> IMAP Connection Severed. Not tracking active mailbox pipelines.
                 </div>
               )}

               <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center'}}>
                   <div>
                      <strong style={{display: 'block', fontSize: 14, marginBottom: 4}}>Priority Filter NLP Model</strong>
                      <span style={{fontSize: 13, color: 'var(--text-muted)'}}>Only extract emails identified strictly as "Assignments" or "Announcements". Ignore UI noise.</span>
                   </div>
                   <div onClick={() => imapStatus && setPriorityFilter(!priorityFilter)} style={{width: 44, height: 24, borderRadius: 12, background: (imapStatus && priorityFilter) ? 'var(--urgent)' : 'var(--bg)', border: '1px solid var(--border-strong)', position: 'relative', cursor: imapStatus ? 'pointer' : 'not-allowed', transition: 'all 0.3s ease', opacity: imapStatus ? 1 : 0.5}}>
                      <div style={{width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 1, left: (imapStatus && priorityFilter) ? 20 : 2, transition: 'all 0.3s ease'}}></div>
                   </div>
               </div>
               
               <div style={{padding: 16, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)'}}>
                  <strong style={{color: 'var(--text-faint)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8}}>Current Authenticated Mailbox</strong>
                  <code style={{fontSize: 13, color: imapStatus ? 'var(--text-muted)' : 'var(--urgent)', fontFamily: 'monospace'}}>student@university.edu ({imapStatus ? 'Tokens Valid' : 'Keys Dropped'})</code>
               </div>

               <div style={{display: 'flex', justifyContent: 'space-between', background: 'var(--surface-hover)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'}}>
                  <div>
                    <strong style={{fontSize: 32, display: 'block', color: 'var(--urgent)'}}>{gmailTasks.length}</strong>
                    <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Extracted Tasks</span>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <strong style={{fontSize: 32, display: 'block', color: 'var(--text)'}}>{gmailNotifs.length}</strong>
                    <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Priority Logs Flagged</span>
                  </div>
               </div>
            </div>
         </div>
         
         <div className="panel glass-panel panel-accent">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-envelope-open-text text-urgent"></i> NLP Scraped Inbox Logs</h2>
               <span className="badge" style={{background: 'var(--urgent-subtle)', color: 'var(--urgent)', border: '1px solid var(--urgent)'}}>{gmailNotifs.length} items queued</span>
            </div>
            <div className="notification-stream" style={{padding: '0 24px 24px'}}>
            {!imapStatus ? (
               <div style={{color: 'var(--urgent)', padding: 16, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 14}}>
                  <strong>WARNING:</strong> Mailbox connection is completely dead. Will not scrape backend.
               </div>
            ) : gmailNotifs.length === 0 ? (
                <div style={{color: 'var(--text-muted)', fontSize: 13}}>No urgent email vectors caught by the model recently. Clean mailbox!</div>
            ) : (
                gmailNotifs.map(n => (
                   <div className="notif-item" key={n.id}>
                      <div className="notif-icon-wrap" style={{background: 'var(--surface-hover)', color: 'var(--urgent)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <i className="fa-regular fa-envelope"></i>
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
