import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function GmailIntegration() {
  const { notifications, tasks, apiFetch, authUser, API_BASE_URL } = useAppContext();
  const location = useLocation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false, email: null });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncError, setSyncError] = useState('');
  const [priorityFilter, setPriorityFilter] = useState(true);

  const gmailNotifs = notifications.filter(n => n.source === 'gmail');
  const gmailTasks = tasks.filter(t => t.source === 'gmail');

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const payload = await apiFetch('/google/status');
      setGoogleStatus({
        configured: Boolean(payload?.configured),
        connected: Boolean(payload?.connected),
        email: payload?.email || null,
      });
    } catch {
      setGoogleStatus({ configured: false, connected: false, email: null });
    } finally {
      setLoadingStatus(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadStatus();
    // If redirected back from OAuth with google_connected=1, show success
    const params = new URLSearchParams(location.search);
    if (params.get('google_connected') === '1') {
      setSyncMsg('Google account connected! You can now sync Gmail.');
    }
  }, [loadStatus, location.search]);

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncMsg('');
    setSyncError('');
    try {
      const payload = await apiFetch('/gmail/fetch');
      const saved = payload?.stats?.new_notifications_saved ?? payload?.saved ?? 0;
      setSyncMsg(`Gmail sync complete. ${saved} new notifications saved.`);
    } catch (err) {
      setSyncError(err?.message || 'Gmail sync failed. Check your connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = () => {
    const userId = authUser?.id || '';
    const url = `/auth/google?user_id=${encodeURIComponent(userId)}&next_path=integrations/gmail`;
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await apiFetch('/google/disconnect', { method: 'DELETE' });
      setGoogleStatus(prev => ({ ...prev, connected: false, email: null }));
      setSyncMsg('Google account disconnected.');
    } catch (err) {
      setSyncError(err?.message || 'Could not disconnect.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const connected = googleStatus.connected;

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--urgent-subtle)', color: 'var(--urgent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            <i className="fa-regular fa-envelope"></i>
          </div>
          <div>
            <h1 style={{ margin: '0 0 8px 0' }}>Gmail Integration</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {loadingStatus ? 'Checking connection...' : connected
                ? `Connected${googleStatus.email ? ` as ${googleStatus.email}` : ''} — ready to sync academic emails.`
                : 'Connect your Google account to sync Gmail messages into AcadPulse.'}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            {connected ? (
              <>
                <button className="btn btn-outline" onClick={handleDisconnect} disabled={isDisconnecting}>
                  {isDisconnecting ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Disconnecting...</> : 'Disconnect Google'}
                </button>
                <button className="btn btn-primary" onClick={handleForceSync} disabled={isSyncing}>
                  {isSyncing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing...</> : <><i className="fa-solid fa-rotate"></i> Force Sync</>}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={handleConnect} disabled={loadingStatus}>
                <i className="fa-brands fa-google"></i> Connect with Google
              </button>
            )}
          </div>
        </div>
      </section>

      {(syncMsg || syncError) && (
        <div style={{ padding: '0 0 0 0' }}>
          {syncMsg && (
            <div style={{ margin: '16px 0 0', padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--success-subtle)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: 13 }}>
              <i className="fa-solid fa-check" style={{ marginRight: 8 }}></i>{syncMsg}
            </div>
          )}
          {syncError && (
            <div style={{ margin: '16px 0 0', padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--urgent-subtle)', border: '1px solid var(--urgent)', color: 'var(--urgent)', fontSize: 13 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>{syncError}
            </div>
          )}
        </div>
      )}

      <div className="content-grid" style={{ marginTop: 24 }}>
        <div className="panel tasks-panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-sliders text-urgent"></i> Inbox Settings</h2>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!connected && !loadingStatus && (
              <div style={{ padding: 16, background: 'var(--warning-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning)', color: 'var(--warning)', fontSize: 13 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>
                Gmail is not connected.{' '}
                {!googleStatus.configured
                  ? 'Google OAuth is not configured on the server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env.'
                  : 'Click "Connect with Google" above to authorize AcadPulse to read your Gmail.'}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Priority Filter</strong>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Only extract emails classified as assignments or announcements.</span>
              </div>
              <div
                onClick={() => connected && setPriorityFilter(!priorityFilter)}
                style={{ width: 44, height: 24, borderRadius: 12, background: (connected && priorityFilter) ? 'var(--urgent)' : 'var(--bg)', border: '1px solid var(--border-strong)', position: 'relative', cursor: connected ? 'pointer' : 'not-allowed', transition: 'all 0.3s', opacity: connected ? 1 : 0.4 }}
              >
                <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 1, left: (connected && priorityFilter) ? 20 : 2, transition: 'all 0.3s' }}></div>
              </div>
            </div>

            <div style={{ padding: 16, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)' }}>
              <strong style={{ color: 'var(--text-faint)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Connected Account</strong>
              <code style={{ fontSize: 13, color: connected ? 'var(--success)' : 'var(--urgent)', fontFamily: 'monospace' }}>
                {loadingStatus ? 'Checking...' : connected ? (googleStatus.email || 'Google account connected') : 'Not connected'}
              </code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-hover)', padding: 20, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div>
                <strong style={{ fontSize: 32, display: 'block', color: 'var(--urgent)' }}>{gmailTasks.length}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Extracted Tasks</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 32, display: 'block', color: 'var(--text)' }}>{gmailNotifs.length}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Messages Logged</span>
              </div>
            </div>

            {!googleStatus.configured && (
              <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>
                <strong style={{ display: 'block', marginBottom: 8, color: 'var(--text)' }}>Setup Required</strong>
                <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>Go to <strong>Google Cloud Console</strong> → create a project</li>
                  <li>Enable <strong>Gmail API</strong> and <strong>Google Classroom API</strong></li>
                  <li>Create OAuth 2.0 credentials (Web Application)</li>
                  <li>Add redirect URI: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{window.location.origin}/auth/google/callback</code></li>
                  <li>Add <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>GOOGLE_CLIENT_ID</code> and <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>GOOGLE_CLIENT_SECRET</code> to <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>backend/.env</code></li>
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-envelope-open-text text-urgent"></i> Gmail Logs</h2>
            <span className="badge" style={{ background: 'var(--urgent-subtle)', color: 'var(--urgent)', border: '1px solid var(--urgent)' }}>{gmailNotifs.length} items</span>
          </div>
          <div className="notification-stream" style={{ padding: '0 24px 24px' }}>
            {!connected ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
                <i className="fa-regular fa-envelope" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }}></i>
                Connect Gmail to see your academic emails here.
              </div>
            ) : gmailNotifs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No Gmail messages yet. Click "Force Sync" to pull emails.</div>
            ) : (
              gmailNotifs.map(n => (
                <div className="notif-item" key={n.id}>
                  <div className="notif-icon-wrap" style={{ background: 'var(--surface-hover)', color: 'var(--urgent)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  );
}
