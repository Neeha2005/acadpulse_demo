import { useState } from 'react';

export default function Integrations() {
  const [syncing, setSyncing] = useState(null);
  
  const handleForceSync = (platform) => {
    setSyncing(platform);
    console.log(`[API MOCK TETHER] POST backend.com/api/sync/${platform}`);
    setTimeout(() => {
      setSyncing(null);
    }, 1500);
  };

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">CONNECTED SOURCES</span>
          <h1>Manage Integrations</h1>
          <p>Link your academic platforms to pull assignments and messages automatically.</p>
        </div>
      </section>
      <div className="panel glass-panel panel-accent">
        <div className="panel-header">
          <h2 className="panel-title"><i className="fa-solid fa-link text-primary"></i> Linked Platforms</h2>
        </div>
        <div className="tasks-list">
           <div className="notif-item">
             <div className="notif-icon-wrap whatsapp"><i className="fa-brands fa-whatsapp"></i></div>
             <div className="notif-content">
               <div className="notif-header"><span className="notif-sender">WhatsApp (Baileys Node)</span></div>
               <p className="notif-preview">Status: Active Connection</p>
             </div>
             <button className="btn btn-outline" onClick={() => handleForceSync('whatsapp')} disabled={syncing === 'whatsapp'}>
                {syncing === 'whatsapp' ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing...</> : 'Force Sync'}
             </button>
           </div>
           
           <div className="notif-item">
             <div className="notif-icon-wrap classroom"><i className="fa-brands fa-google"></i></div>
             <div className="notif-content">
               <div className="notif-header"><span className="notif-sender">Google Classroom</span></div>
               <p className="notif-preview">Status: Token Established</p>
             </div>
             <button className="btn btn-outline" onClick={() => handleForceSync('classroom')} disabled={syncing === 'classroom'}>
                {syncing === 'classroom' ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing...</> : 'Force Sync'}
             </button>
           </div>
           
        </div>
      </div>
    </div>
  );
}
