import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AttachmentList from '../components/AttachmentList';
import { useAppContext } from '../context/AppContext';

const PAGE_SIZE = 20;
const FILTERS = [
  ['all', 'All'],
  ['announcement', 'Announcements'],
  ['assignment', 'Assignments'],
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
  const clean = String(text || '').replace(/^Title:\s*/i, '').split('\n').find(Boolean) || 'Classroom item';
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return <div className={`integration-toast ${type}`}>{message}</div>;
}

function SkeletonRows() {
  return <div className="integration-log-list">{[0, 1, 2].map((item) => <div className="integration-skeleton-row" key={item} />)}</div>;
}

export default function ClassroomIntegration() {
  const { API_BASE_URL, apiFetch, authUser, user, authReady, authToken, refreshNotifications } = useAppContext();
  const location = useLocation();
  const userId = authUser?.id || user?.id || localStorage.getItem('acadpulse_user_id') || '';
  const [googleStatus, setGoogleStatus] = useState({ connected: false });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [localCourses, setLocalCourses] = useState([]);
  const [classroomCourses, setClassroomCourses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedClassroomCourse, setSelectedClassroomCourse] = useState('');
  const [selectedLocalCourse, setSelectedLocalCourse] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const connected = googleStatus.connected;
  const selectedClassroom = classroomCourses.find((course) => course.classroom_id === selectedClassroomCourse);

  const loadStatus = useCallback(async () => {
    if (!authToken) return;
    setLoadingStatus(true);
    try {
      const payload = await apiFetch('/google/status');
      setGoogleStatus({ connected: Boolean(payload?.connected) });
    } catch {
      setGoogleStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  }, [apiFetch, authToken]);

  const loadMappingData = useCallback(async (syncCourses = false) => {
    if (!userId) return;
    setLoadingMappings(true);
    try {
      const [coursesPayload, classroomPayload, mappingsPayload] = await Promise.all([
        apiFetch(`/courses?user_id=${encodeURIComponent(userId)}`, {}, false),
        apiFetch(`/classroom/courses?user_id=${encodeURIComponent(userId)}${syncCourses ? '&sync=true' : ''}`),
        apiFetch(`/course-source-mappings?source_type=classroom&user_id=${encodeURIComponent(userId)}`, {}, false),
      ]);
      const nextLocalCourses = Array.isArray(coursesPayload?.courses) ? coursesPayload.courses : [];
      const nextClassroomCourses = Array.isArray(classroomPayload?.courses) ? classroomPayload.courses : [];
      const nextMappings = Array.isArray(mappingsPayload?.mappings) ? mappingsPayload.mappings : [];
      setLocalCourses(nextLocalCourses);
      setClassroomCourses(nextClassroomCourses);
      setMappings(nextMappings);
      setSelectedLocalCourse((current) => current || nextLocalCourses[0]?.id || '');
      setSelectedClassroomCourse((current) => current || nextClassroomCourses[0]?.classroom_id || '');
    } catch (error) {
      setToast({ message: error?.message || 'Unable to load Classroom data', type: 'error' });
    } finally {
      setLoadingMappings(false);
    }
  }, [apiFetch, userId]);

  const loadLogs = useCallback(async (nextOffset = 0, append = false) => {
    if (!userId) return;
    setLoadingLogs(true);
    try {
      const payload = await apiFetch(`/notifications?user_id=${encodeURIComponent(userId)}&source=classroom&limit=${PAGE_SIZE}&offset=${nextOffset}`, {}, false);
      const rows = Array.isArray(payload?.notifications) ? payload.notifications : [];
      setLogs((current) => append ? [...current, ...rows] : rows);
      setOffset(nextOffset + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      setToast({ message: error?.message || 'Unable to load Classroom logs', type: 'error' });
    } finally {
      setLoadingLogs(false);
    }
  }, [apiFetch, userId]);

  const syncClassroom = useCallback(async () => {
    setSyncing(true);
    try {
      await loadMappingData(true);
      setToast({ message: 'Classroom courses refreshed', type: 'success' });
      await loadLogs(0, false);
      refreshNotifications?.();
    } catch (error) {
      setToast({ message: error?.message || 'Unable to sync Classroom', type: 'error' });
    } finally {
      setSyncing(false);
    }
  }, [apiFetch, loadLogs, loadMappingData, refreshNotifications]);

  useEffect(() => {
    if (!authReady || !authToken) return undefined;
    const params = new URLSearchParams(location.search);
    const oauthReturned = params.get('google_connected') === '1' || params.get('connection') === '1';
    loadStatus();
    loadMappingData(connected);
    loadLogs(0, false);
    if (oauthReturned) {
      setGoogleStatus({ connected: true });
      window.dispatchEvent(new Event('acadpulse:integration-status-refresh'));
      setToast({ message: 'Google connected successfully', type: 'success' });
      window.history.replaceState({}, '', '/integrations/classroom');
      setTimeout(loadStatus, 1000);
      setTimeout(syncClassroom, 800);
    }
    return undefined;
  }, [authReady, authToken, loadLogs, loadMappingData, loadStatus, location.search, syncClassroom]);

  const displayedLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => new Date(b.received_at || b.created_at || 0) - new Date(a.received_at || a.created_at || 0));
    if (filter === 'all') return sorted;
    return sorted.filter((item) => String(item.category || '').toLowerCase() === filter);
  }, [filter, logs]);

  const saveMapping = async (event) => {
    event.preventDefault();
    if (!selectedClassroomCourse || (!selectedLocalCourse && !newCourseName.trim())) {
      setToast({ message: 'Select both courses before saving', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/courses/map', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          classroom_course_id: selectedClassroomCourse,
          classroom_course_name: selectedClassroom?.classroom_name || selectedClassroomCourse,
          acadpulse_course_id: selectedLocalCourse === '__new__' ? '' : selectedLocalCourse,
          acadpulse_course: selectedLocalCourse === '__new__' ? newCourseName.trim() : '',
        }),
      }, false);
      setToast({ message: 'Course mapped successfully', type: 'success' });
      setSelectedClassroomCourse('');
      setSelectedLocalCourse(localCourses[0]?.id || '');
      setNewCourseName('');
      await loadMappingData();
    } catch (error) {
      setToast({ message: error?.message || 'Unable to save mapping', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await apiFetch(`/courses/map/${mappingId}?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' }, false);
      setMappings((current) => current.filter((mapping) => String(mapping.id) !== String(mappingId)));
      setToast({ message: 'Mapping deleted', type: 'success' });
    } catch (error) {
      setToast({ message: error?.message || 'Unable to delete mapping', type: 'error' });
    }
  };

  const handleConnect = () => {
    const params = new URLSearchParams({ next_path: 'integrations/classroom', integration: 'classroom' });
    if (userId) params.set('user_id', userId);
    params.set('frontend_origin', window.location.origin);
    window.location.href = `${API_BASE_URL}/auth/google?${params.toString()}`;
  };

  return (
    <div className="dashboard-scroll integration-page">
      <section className="hero-stats glass-banner">
        <div className="integration-hero">
          <div className="integration-hero-icon classroom"><i className="fa-brands fa-google"></i></div>
          <div>
            <h1>Google Classroom</h1>
            <p>{connected ? 'Connected - map Classroom courses to sync announcements and assignments.' : 'Connect your Google account to sync Classroom content into AcadPulse.'}</p>
          </div>
          <div className="integration-hero-action">
            {connected ? <span className="integration-connected">✓ Connected</span> : (
              <button className="btn btn-primary" onClick={handleConnect} disabled={loadingStatus}><i className="fa-brands fa-google"></i> Connect with Google</button>
            )}
          </div>
        </div>
      </section>

      <div className="content-grid integration-grid">
        <div className="panel tasks-panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-diagram-project text-warning"></i> Course Mapping</h2>
            <button className="text-btn" onClick={syncClassroom} disabled={!connected || syncing}>{syncing ? 'Refreshing...' : 'Refresh'}</button>
          </div>
          <div className="integration-panel-body">
            {!connected && !loadingStatus && <div className="integration-warning"><i className="fa-solid fa-triangle-exclamation"></i> Connect Google above to enable live Classroom sync. Existing mappings can still be edited.</div>}
            <form className="integration-form" onSubmit={saveMapping}>
              <label className="integration-field">
                <span>Classroom Course</span>
                <select value={selectedClassroomCourse} onChange={(e) => setSelectedClassroomCourse(e.target.value)} disabled={loadingMappings}>
                  <option value="">{loadingMappings ? 'Loading your courses...' : classroomCourses.length ? 'Select a Classroom course' : 'No active courses found'}</option>
                  {classroomCourses.map((course) => <option value={course.classroom_id} key={course.classroom_id}>{course.classroom_name || course.classroom_id}</option>)}
                </select>
              </label>
              <label className="integration-field">
                <span>AcadPulse Course</span>
                <select value={selectedLocalCourse} onChange={(e) => setSelectedLocalCourse(e.target.value)}>
                  <option value="">Select a course</option>
                  {localCourses.map((course) => <option value={course.id} key={course.id}>{course.course_code} - {course.course_name}</option>)}
                  <option value="__new__">+ Create new course</option>
                </select>
              </label>
              {selectedLocalCourse === '__new__' && <input className="integration-text-input" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder="New AcadPulse course name" />}
              <button className="btn btn-primary" type="submit" disabled={saving || !selectedClassroomCourse}>{saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-link"></i> Save Mapping</>}</button>
            </form>
            <div className="integration-saved-list">
              <strong>Saved Mappings</strong>
              {mappings.length === 0 ? <span className="integration-muted">No Classroom courses mapped yet</span> : mappings.map((mapping) => (
                <div className="integration-mapping-row" key={mapping.id}>
                  <span>{mapping.source_name || mapping.source_reference_id}</span>
                  <i className="fa-solid fa-arrow-right"></i>
                  <span>{mapping.course_name || mapping.course_code}</span>
                  <button onClick={() => deleteMapping(mapping.id)} aria-label="Delete mapping">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-graduation-cap text-warning"></i> Classroom Logs</h2>
            <span className="badge badge-warning">{displayedLogs.length} items</span>
          </div>
          <div className="integration-panel-body">
            <div className="integration-filter-row">{FILTERS.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
            {loadingLogs && !logs.length ? <SkeletonRows /> : !connected ? (
              <div className="integration-empty"><i className="fa-brands fa-google"></i><span>Connect Google above to see Classroom notifications here.</span></div>
            ) : displayedLogs.length === 0 ? (
              <div className="integration-empty"><i className="fa-brands fa-google"></i><span>No Classroom messages yet. Click "Refresh" to pull data.</span></div>
            ) : (
              <div className="integration-log-list">
                {displayedLogs.map((item) => {
                  const urgent = ['high', 'critical'].includes(String(item.urgency_level || item.urgency_label || '').toLowerCase());
                  return (
                    <div className="integration-log-card" key={item.id}>
                      <button className="integration-expand" onClick={() => setExpanded((cur) => ({ ...cur, [item.id]: !cur[item.id] }))}>{expanded[item.id] ? '⌃' : '⌄'}</button>
                      <div className="integration-log-top">
                        <span className="integration-badge">{item.category || 'classroom'}</span>
                        <span className="integration-course">{item.short_name || item.course_code || item.course_name || item.sender_name || 'Classroom'}</span>
                        {urgent && <span className={`integration-urgency ${item.urgency_level || item.urgency_label}`}>{item.urgency_level || item.urgency_label}</span>}
                        <span className="integration-time">{formatRelativeTime(item.received_at || item.created_at)}</span>
                      </div>
                      <strong>{titleFromText(item.message_text)}</strong>
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
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
}
