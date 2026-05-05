import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function ClassroomIntegration() {
  const { notifications, tasks, apiFetch, authUser } = useAppContext();
  const location = useLocation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [googleStatus, setGoogleStatus] = useState({ configured: false, connected: false });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [localCourses, setLocalCourses] = useState([]);
  const [classroomCourses, setClassroomCourses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedClassroomCourse, setSelectedClassroomCourse] = useState('');
  const [selectedLocalCourse, setSelectedLocalCourse] = useState('');
  const [manualClassroomId, setManualClassroomId] = useState('');
  const [manualClassroomName, setManualClassroomName] = useState('');
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingStatus, setMappingStatus] = useState('');
  const [mappingError, setMappingError] = useState('');

  const classroomNotifs = notifications.filter(n => n.source === 'classroom');
  const classroomTasks = tasks.filter(t => t.source === 'classroom');
  const mappedClassroomIds = useMemo(
    () => new Set(mappings.map(mapping => mapping.source_reference_id)),
    [mappings],
  );

  const loadGoogleStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const payload = await apiFetch('/google/status');
      setGoogleStatus({
        configured: Boolean(payload?.configured),
        connected: Boolean(payload?.connected),
      });
    } catch {
      setGoogleStatus({ configured: false, connected: false });
    } finally {
      setLoadingStatus(false);
    }
  }, [apiFetch]);

  const loadMappingData = useCallback(async () => {
    setLoadingMappings(true);
    setMappingError('');
    try {
      const [coursesPayload, classroomPayload, mappingsPayload] = await Promise.all([
        apiFetch('/courses', {}, false),
        apiFetch('/classroom/courses', {}, false),
        apiFetch('/course-source-mappings?source_type=classroom', {}, false),
      ]);
      const nextLocalCourses = Array.isArray(coursesPayload?.courses) ? coursesPayload.courses : [];
      const nextClassroomCourses = Array.isArray(classroomPayload?.courses) ? classroomPayload.courses : [];
      const nextMappings = Array.isArray(mappingsPayload?.mappings) ? mappingsPayload.mappings : [];
      setLocalCourses(nextLocalCourses);
      setClassroomCourses(nextClassroomCourses);
      setMappings(nextMappings);
      setSelectedLocalCourse(current => current || nextLocalCourses[0]?.id || '');
      setSelectedClassroomCourse(current => current || nextClassroomCourses[0]?.classroom_id || '');
    } catch (error) {
      setMappingError(error.message || 'Unable to load Classroom mapping data.');
    } finally {
      setLoadingMappings(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadGoogleStatus();
    loadMappingData();
    const params = new URLSearchParams(location.search);
    if (params.get('google_connected') === '1') {
      setMappingStatus('Google account connected! Click "Force Sync" to pull Classroom data.');
    }
  }, [loadGoogleStatus, loadMappingData, location.search]);

  const handleConnect = () => {
    const userId = authUser?.id || '';
    window.location.href = `/auth/google?user_id=${encodeURIComponent(userId)}&next_path=integrations/classroom`;
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await apiFetch('/google/disconnect', { method: 'DELETE' });
      setGoogleStatus(prev => ({ ...prev, connected: false }));
      setMappingStatus('Google account disconnected.');
    } catch (err) {
      setMappingError(err?.message || 'Could not disconnect.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setMappingError('');
    setMappingStatus('');
    try {
      const payload = await apiFetch('/classroom/fetch', {}, false);
      const saved = payload?.stats?.new_notifications_saved ?? 0;
      setMappingStatus(`Classroom sync complete. ${saved} new notifications saved.`);
      await loadMappingData();
    } catch (error) {
      setMappingError(error.message || 'Unable to sync Google Classroom right now.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveManualClassroomCourse = async (event) => {
    event.preventDefault();
    const classroomId = manualClassroomId.trim();
    if (!classroomId) { setMappingError('Classroom course ID is required.'); return; }
    setSavingMapping(true);
    setMappingError('');
    setMappingStatus('');
    try {
      await apiFetch('/classroom/courses', {
        method: 'POST',
        body: JSON.stringify({ classroom_id: classroomId, classroom_name: manualClassroomName.trim() || classroomId }),
      }, false);
      setManualClassroomId('');
      setManualClassroomName('');
      setMappingStatus('Classroom course saved. Select a local course to map it.');
      await loadMappingData();
      setSelectedClassroomCourse(classroomId);
    } catch (error) {
      setMappingError(error.message || 'Unable to save Classroom course.');
    } finally {
      setSavingMapping(false);
    }
  };

  const handleSaveMapping = async (event) => {
    event.preventDefault();
    if (!selectedClassroomCourse || !selectedLocalCourse) {
      setMappingError('Select both a Classroom course and a local course.');
      return;
    }
    setSavingMapping(true);
    setMappingError('');
    setMappingStatus('');
    try {
      const payload = await apiFetch('/course-source-mappings', {
        method: 'POST',
        body: JSON.stringify({ source_type: 'classroom', source_reference_id: selectedClassroomCourse, course_id: selectedLocalCourse }),
      }, false);
      setMappings(Array.isArray(payload?.mappings) ? payload.mappings : []);
      setMappingStatus('Mapping saved. Future Classroom content from this course will attach to the selected course.');
    } catch (error) {
      setMappingError(error.message || 'Unable to save Classroom mapping.');
    } finally {
      setSavingMapping(false);
    }
  };

  const connected = googleStatus.connected;

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--warning-subtle)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            <i className="fa-brands fa-google"></i>
          </div>
          <div>
            <h1 style={{ margin: '0 0 8px 0' }}>Google Classroom</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {loadingStatus ? 'Checking connection...' : connected
                ? 'Connected — map Classroom courses to sync announcements and assignments.'
                : 'Connect your Google account to sync Classroom content into AcadPulse.'}
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

      <div className="content-grid" style={{ marginTop: 24 }}>
        <div className="panel tasks-panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-diagram-project text-warning"></i> Course Mapping</h2>
            <button className="text-btn" onClick={loadMappingData} disabled={loadingMappings}>
              {loadingMappings ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!connected && !loadingStatus && (
              <div style={{ padding: 12, background: 'var(--warning-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning)', color: 'var(--warning)', fontSize: 13 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>
                {!googleStatus.configured
                  ? 'Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env.'
                  : 'Connect Google above to enable live Classroom sync. Existing mappings can still be edited.'}
              </div>
            )}

            <form onSubmit={handleSaveMapping} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Classroom Course</label>
                <select value={selectedClassroomCourse} onChange={e => setSelectedClassroomCourse(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">Select a Classroom course</option>
                  {classroomCourses.map(course => (
                    <option value={course.classroom_id} key={course.classroom_id}>
                      {course.classroom_name || course.classroom_id}{mappedClassroomIds.has(course.classroom_id) ? ' — mapped' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>AcadPulse Course</label>
                <select value={selectedLocalCourse} onChange={e => setSelectedLocalCourse(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">Select a course</option>
                  {localCourses.map(course => (
                    <option value={course.id} key={course.id}>{course.course_code} — {course.course_name}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" type="submit" disabled={savingMapping || !selectedClassroomCourse || !selectedLocalCourse}>
                {savingMapping ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-link"></i> Save Mapping</>}
              </button>
            </form>

            <form onSubmit={handleSaveManualClassroomCourse} style={{ padding: 16, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <strong style={{ fontSize: 13 }}>Add Classroom course manually</strong>
              <input value={manualClassroomId} onChange={e => setManualClassroomId(e.target.value)} placeholder="Google Classroom course ID" style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
              <input value={manualClassroomName} onChange={e => setManualClassroomName(e.target.value)} placeholder="Course name (optional)" style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
              <button className="btn btn-outline" type="submit" disabled={savingMapping || !manualClassroomId.trim()}>
                <i className="fa-solid fa-plus"></i> Add Course
              </button>
            </form>

            {mappingError && (
              <div style={{ color: 'var(--urgent)', padding: 12, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 13 }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {mappingError}
              </div>
            )}
            {mappingStatus && (
              <div style={{ color: 'var(--success)', padding: 12, background: 'var(--success-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success)', fontSize: 13 }}>
                <i className="fa-solid fa-check"></i> {mappingStatus}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface-hover)', padding: 20, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div>
                <strong style={{ fontSize: 32, display: 'block', color: 'var(--warning)' }}>{classroomTasks.length}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active Tasks</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 32, display: 'block', color: 'var(--text)' }}>{mappings.length}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Courses Mapped</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-graduation-cap text-warning"></i> Classroom Logs</h2>
            <span className="badge badge-warning">{classroomNotifs.length} items</span>
          </div>
          <div className="notification-stream" style={{ padding: '0 24px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <strong style={{ fontSize: 13, color: 'var(--text-muted)' }}>Saved mappings</strong>
              {mappings.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No Classroom courses mapped yet.</div>
              ) : mappings.map(mapping => (
                <div key={mapping.id} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{mapping.source_name || mapping.source_reference_id}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{mapping.source_reference_id}</div>
                  </div>
                  <span className="badge badge-warning" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>{mapping.course_code}</span>
                </div>
              ))}
            </div>

            {!connected ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
                <i className="fa-brands fa-google" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }}></i>
                Connect Google above to see Classroom notifications here.
              </div>
            ) : classroomNotifs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No Classroom messages yet. Click "Force Sync" to pull data.</div>
            ) : (
              classroomNotifs.map(n => (
                <div className="notif-item" key={n.id}>
                  <div className="notif-icon-wrap classroom" style={{ background: 'var(--surface-hover)', color: 'var(--warning)' }}>
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
  );
}
