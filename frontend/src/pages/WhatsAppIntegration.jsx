import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function WhatsAppIntegration() {
  const { notifications } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);
  const [active, setActive] = useState(true);
  const [botEnabled, setBotEnabled] = useState(true);
  const [nlpEnabled, setNlpEnabled] = useState(true);

  const whatsappNotifs = notifications.filter(n => n.source === 'whatsapp');

  const handleForceSync = () => {
    setIsSyncing(true);
    console.log("[API MOCK TETHER] POST backend.com/api/integrations/whatsapp/sync");
    setTimeout(() => {
        setIsSyncing(false);
    }, 1500);
  }

  return (
    <div className="dashboard-scroll">
      <div className="hero-stats" style={{paddingBottom: 24, borderBottom: '1px solid var(--border)'}}>
        <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
           <div style={{width: 64, height: 64, borderRadius: 16, background: 'var(--whatsapp-subtle)', color: 'var(--whatsapp)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32}}>
              <i className="fa-brands fa-whatsapp"></i>
           </div>
           <div>
              <h1 style={{margin: '0 0 8px 0'}}>WhatsApp Interface</h1>
              <p style={{margin: 0, color: 'var(--text-muted)'}}>Manage your AI text routing, synchronization patterns, and incoming unread hooks.</p>
           </div>
           <div style={{marginLeft: 'auto', display: 'flex', gap: 16}}>
               <button className="btn btn-outline" onClick={() => setActive(!active)}>
                  {active ? 'Sever Connection' : 'Establish Connect'}
               </button>
               <button className="btn btn-primary" onClick={handleForceSync} disabled={isSyncing || !active}>
                  {isSyncing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Targeting node...</> : 'Force Data Pull'}
               </button>
           </div>
        </div>
      </div>
      
      <div className="content-grid" style={{marginTop: 32}}>
         <div className="panel tasks-panel">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-sliders text-primary"></i> Environment Constraints</h2>
            </div>
            <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 24}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center'}}>
                   <div>
                      <strong style={{display: 'block', fontSize: 14, marginBottom: 4}}>Reflexive Bot Intercept</strong>
                      <span style={{fontSize: 13, color: 'var(--text-muted)'}}>Allow AI to autonomously reply to Assignment timeline requests.</span>
                   </div>
                   <div onClick={() => active && setBotEnabled(!botEnabled)} style={{width: 44, height: 24, borderRadius: 12, background: (active && botEnabled) ? 'var(--whatsapp)' : 'var(--bg)', border: '1px solid var(--border-strong)', position: 'relative', cursor: active ? 'pointer' : 'not-allowed', transition: 'all 0.3s ease', opacity: active ? 1 : 0.5}}>
                      <div style={{width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 1, left: (active && botEnabled) ? 20 : 2, transition: 'all 0.3s ease'}}></div>
                   </div>
               </div>
               
               <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center'}}>
                   <div>
                      <strong style={{display: 'block', fontSize: 14, marginBottom: 4}}>Semantic NLP Stripping</strong>
                      <span style={{fontSize: 13, color: 'var(--text-muted)'}}>Filter out chaotic chat junk. Store ONLY strictly defined deadline strings.</span>
                   </div>
                   <div onClick={() => active && setNlpEnabled(!nlpEnabled)} style={{width: 44, height: 24, borderRadius: 12, background: (active && nlpEnabled) ? 'var(--whatsapp)' : 'var(--bg)', border: '1px solid var(--border-strong)', position: 'relative', cursor: active ? 'pointer' : 'not-allowed', transition: 'all 0.3s ease', opacity: active ? 1 : 0.5}}>
                      <div style={{width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 1, left: (active && nlpEnabled) ? 20 : 2, transition: 'all 0.3s ease'}}></div>
                   </div>
               </div>
               
               <div style={{padding: 16, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)'}}>
                  <strong style={{color: 'var(--text-faint)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8}}>API Webhook Target Architecture</strong>
                  <code style={{fontSize: 13, color: 'var(--whatsapp)', fontFamily: 'monospace', wordBreak: 'break-all'}}>https://backend.com/api/webhooks/twillio_pipe_j2x9/wa_layer</code>
               </div>
            </div>
         </div>
         
         <div className="panel">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-satellite-dish text-whatsapp"></i> NLP Scraped Logs</h2>
               <span className="badge badge-success">{whatsappNotifs.length} items logged</span>
            </div>
            <div className="notification-stream" style={{padding: '0 24px 24px'}}>
            {!active ? (
               <div style={{color: 'var(--urgent)', padding: 16, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 14}}>
                  <strong>WARNING:</strong> Pipe severed. Not capturing data.
               </div>
            ) : whatsappNotifs.length === 0 ? (
                <div style={{color: 'var(--text-muted)', fontSize: 13}}>No recent data from this vector.</div>
            ) : (
                whatsappNotifs.map(n => (
                   <div className="notif-item" key={n.id}>
                      <div className="notif-icon-wrap whatsapp" style={{background: 'var(--surface-hover)'}}>
                        <i className="fa-brands fa-whatsapp text-whatsapp"></i>
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
