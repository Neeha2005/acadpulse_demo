import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AttachmentList from '../components/AttachmentList';
import { useAppContext } from '../context/AppContext';

const PAGE_SIZE = 20;
const FILTERS = [
  ['all', 'All'],
  ['assignment', 'Assignments'],
  ['quiz', 'Quizzes'],
  ['announcement', 'Announcements'],
  ['material', 'Materials'],
];

function formatRelativeTime(value) {
  if (!value) return 'just now';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDue(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function titleFromText(text) {
  const clean = String(text || '').replace(/^Title:\s*/i, '').split('\n').find(Boolean) || 'Gmail message';
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

function IntegrationToast({ message, type, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return <div className={`integration-toast ${type}`}>{message}</div>;
}

function SkeletonRows() {
  return (
    <div className="integration-log-list">
      {[0, 1, 2].map((item) => <div className="integration-skeleton-row" key={item} />)}
    </div>
  );
}

export default function GmailIntegration() {
  const { apiFetch, authUser, user, authReady, authToken, refreshNotifications } = useAppContext();
  const location = useLocation();
  const userId = authUser?.id || user?.id || localStorage.getItem('acadpulse_user_id') || '';
  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: '' });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState(() => localStorage.getItem('acadpulse_gmail_priority_filter') !== 'false');
  const [maxEmails, setMaxEmails] = useState(() => Number(localStorage.getItem('acadpulse_gmail_max_results') || 20));
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem('acadpulse_gmail_auto_sync') === 'true');
  const [lastSync, setLastSync] = useState(() => localStorage.getItem('acadpulse_gmail_last_sync') || '');
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const connected = googleStatus.connected;

  const loadStatus = useCallback(async () => {
    if (!authToken) return;
    setLoadingStatus(true);
    try {
      const payload = await apiFetch('/google/status');
      setGoogleStatus({
        connected: Boolean(payload?.connected),
        email: payload?.email || localStorage.getItem('acadpulse_user_email') || '',
      });
    } catch {
      setGoogleStatus((current) => ({ ...current, connected: false }));
    } finally {
      setLoadingStatus(false);
    }
  }, [apiFetch, authToken]);

  const loadLogs = useCallback(async (nextOffset = 0, append = false) => {
    if (!userId) return;
    setLoadingLogs(true);
    try {
      const payload = await apiFetch(`/notifications?user_id=${encodeURIComponent(userId)}&source=gmail&limit=${PAGE_SIZE}&offset=${nextOffset}`, {}, false);
      const rows = Array.isArray(payload?.notifications) ? payload.notifications : [];
      setLogs((current) => append ? [...current, ...rows] : rows);
      setOffset(nextOffset + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      setToast({ message: error?.message || 'Unable to load Gmail logs', type: 'error' });
    } finally {
      setLoadingLogs(false);
    }
  }, [apiFetch, userId]);

  const fetchNow = useCallback(async () => {
    setFetching(true);
    try {
      const payload = await apiFetch(`/gmail/fetch?max_results=${maxEmails}&priority_only=${priorityFilter ? 'true' : 'false'}`);
      const count = payload?.new_notifications_saved ?? payload?.stats?.new_notifications_saved ?? 0;
      const stamp = new Date().toISOString();
      localStorage.setItem('acadpulse_gmail_last_sync', stamp);
      setLastSync(stamp);
      setToast({ message: `Fetched ${count} new emails`, type: 'success' });
      await loadLogs(0, false);
      refreshNotifications?.();
    } catch (error) {
      setToast({ message: error?.message || 'Gmail fetch failed', type: 'error' });
    } finally {
      setFetching(false);
    }
  }, [apiFetch, loadLogs, maxEmails, priorityFilter, refreshNotifications]);

  useEffect(() => {
    localStorage.setItem('acadpulse_gmail_priority_filter', String(priorityFilter));
  }, [priorityFilter]);

  useEffect(() => {
    localStorage.setItem('acadpulse_gmail_max_results', String(maxEmails));
  }, [maxEmails]);

  useEffect(() => {
    localStorage.setItem('acadpulse_gmail_auto_sync', String(autoSync));
  }, [autoSync]);

  useEffect(() => {
    if (!authReady || !authToken) return undefined;
    const params = new URLSearchParams(location.search);
    const oauthReturned = params.get('google_connected') === '1' || params.get('connection') === '1';
    loadStatus();
    loadLogs(0, false);
    if (oauthReturned) {
      setGoogleStatus((current) => ({ ...current, connected: true, email: current.email || localStorage.getItem('acadpulse_user_email') || '' }));
      window.dispatchEvent(new Event('acadpulse:integration-status-refresh'));
      setToast({ message: 'Google connected successfully', type: 'success' });
      window.history.replaceState({}, '', '/integrations/gmail');
      setTimeout(loadStatus, 1000);
      setTimeout(loadLogs, 1200, 0, false);
    }
    if (autoSync || oauthReturned) {
      setTimeout(fetchNow, oauthReturned ? 1600 : 300);
    }
    return undefined;
  }, [authReady, authToken, autoSync, fetchNow, loadLogs, loadStatus, location.search]);

  const displayedLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => new Date(b.received_at || b.created_at || 0) - new Date(a.received_at || a.created_at || 0));
    if (filter === 'all') return sorted;
    return sorted.filter((item) => String(item.category || '').toLowerCase() === filter);
  }, [filter, logs]);

  const handleConnect = () => {
    window.location.href = `/auth/google?user_id=${encodeURIComponent(userId)}&next_path=integrations/gmail`;
  };

  return (
    <div className="dashboard-scroll integration-page">
      <section className="hero-stats glass-banner">
        <div className="integration-hero">
          <div className="integration-hero-icon gmail"><i className="fa-regular fa-envelope"></i></div>
          <div>
            <h1>Gmail Integration</h1>
            <p>{connected ? `Connected${googleStatus.email ? ` as ${googleStatus.email}` : ''} - ready to sync academic emails.` : 'Connect your Google account to sync Gmail messages into AcadPulse.'}</p>
          </div>
          <div className="integration-hero-action">
            {connected ? <span className="integration-connected">✓ Connected{googleStatus.email ? ` as: ${googleStatus.email}` : ''}</span> : (
              <button className="btn btn-primary" onClick={handleConnect} disabled={loadingStatus}><i className="fa-brands fa-google"></i> Connect with Google</button>
            )}
          </div>
        </div>
      </section>

      <div className="content-grid integration-grid">
        <div className="panel tasks-panel glass-panel panel-accent">
          <div className="panel-header"><h2 className="panel-title"><i className="fa-solid fa-sliders text-urgent"></i> Inbox Settings</h2></div>
          <div className="integration-panel-body">
            {!connected && !loadingStatus && <div className="integration-warning"><i className="fa-solid fa-triangle-exclamation"></i> Gmail is not connected. Click "Connect with Google" above to authorize AcadPulse to read your Gmail.</div>}
            <label className="integration-setting-row">
              <span><strong>Priority Filter</strong><small>Only extract emails classified as assignments or announcements.</small></span>
              <input type="checkbox" checked={priorityFilter} onChange={(e) => setPriorityFilter(e.target.checked)} />
            </label>
            <label className="integration-field">
              <span>Max emails to fetch</span>
              <input type="number" min="5" max="50" value={maxEmails} onChange={(e) => setMaxEmails(Math.min(50, Math.max(5, Number(e.target.value) || 20)))} />
            </label>
            <label className="integration-setting-row">
              <span><strong>Auto-sync</strong><small>Fetch automatically every time this page loads.</small></span>
              <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            </label>
            <button className="btn btn-primary" onClick={fetchNow} disabled={!connected || fetching}>
              {fetching ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Fetching...</> : <><i className="fa-solid fa-rotate"></i> Fetch Now</>}
            </button>
            <div className="integration-meta">Last synced: {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}</div>
          </div>
        </div>

        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-envelope-open-text text-urgent"></i> Gmail Logs</h2>
            <span className="badge" style={{ background: 'var(--urgent-subtle)', color: 'var(--urgent)', border: '1px solid var(--urgent)' }}>{displayedLogs.length} items</span>
          </div>
          <div className="integration-panel-body">
            <div className="integration-filter-row">
              {FILTERS.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
            </div>
            {loadingLogs && !logs.length ? <SkeletonRows /> : !connected ? (
              <div className="integration-empty"><i className="fa-regular fa-envelope"></i><span>Connect Gmail to see your academic emails here.</span></div>
            ) : displayedLogs.length === 0 ? (
              <div className="integration-empty"><i className="fa-regular fa-envelope"></i><span>No Gmail messages yet. Click "Fetch Now" to pull emails.</span></div>
            ) : (
              <div className="integration-log-list">
                {displayedLogs.map((item) => {
                  const urgent = ['high', 'critical'].includes(String(item.urgency_level || item.urgency_label || '').toLowerCase());
                  return (
                    <div className="integration-log-card" key={item.id}>
                      <button className="integration-expand" onClick={() => setExpanded((cur) => ({ ...cur, [item.id]: !cur[item.id] }))}>{expanded[item.id] ? '⌃' : '⌄'}</button>
                      <div className="integration-log-top">
                        <span className="integration-badge">{item.category || 'email'}</span>
                        {urgent && <span className={`integration-urgency ${item.urgency_level || item.urgency_label}`}>{item.urgency_level || item.urgency_label}</span>}
                        <span className="integration-time">{formatRelativeTime(item.received_at || item.created_at)}</span>
                      </div>
                      <strong>{titleFromText(item.message_text)}</strong>
                      <small>{item.sender_name || 'Gmail'} {item.source_reference_id ? `- ${item.source_reference_id}` : ''}</small>
                      {item.deadline && <small>Due: {formatDue(item.deadline)}</small>}
                      {expanded[item.id] && (
                        <>
                          <p>{String(item.expanded_text || item.message_text || '').slice(0, 300)}</p>
                          <AttachmentList attachments={item.attachments} compact />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {connected && hasMore && <button className="btn btn-outline integration-load-more" onClick={() => loadLogs(offset, true)} disabled={loadingLogs}>Load more</button>}
          </div>
        </div>
      </div>
      <IntegrationToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
