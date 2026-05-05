import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function ClassroomIntegration() {
  const { notifications, tasks, apiFetch } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);
  const [oauthStatus, setOauthStatus] = useState(true);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMappingData();
  }, [loadMappingData]);

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

  const handleOAuth = () => {
    setOauthStatus(!oauthStatus);
  };

  const handleSaveManualClassroomCourse = async (event) => {
    event.preventDefault();
    const classroomId = manualClassroomId.trim();
    if (!classroomId) {
      setMappingError('Classroom course ID is required.');
      return;
    }

    setSavingMapping(true);
    setMappingError('');
    setMappingStatus('');

    try {
      await apiFetch('/classroom/courses', {
        method: 'POST',
        body: JSON.stringify({
          classroom_id: classroomId,
          classroom_name: manualClassroomName.trim() || classroomId,
        }),
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
        body: JSON.stringify({
          source_type: 'classroom',
          source_reference_id: selectedClassroomCourse,
          course_id: selectedLocalCourse,
        }),
      }, false);

      setMappings(Array.isArray(payload?.mappings) ? payload.mappings : []);
      setMappingStatus('Mapping saved. Future Classroom content from this course will attach to the selected course.');
    } catch (error) {
      setMappingError(error.message || 'Unable to save Classroom mapping.');
    } finally {
      setSavingMapping(false);
    }
  };

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
           <div style={{width: 64, height: 64, borderRadius: 16, background: 'var(--warning-subtle)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32}}>
              <i className="fa-brands fa-google"></i>
           </div>
           <div>
              <h1 style={{margin: '0 0 8px 0'}}>Google Classroom Interface</h1>
              <p style={{margin: 0, color: 'var(--text-muted)'}}>Map Classroom course IDs to your AcadPulse course roster and sync academic updates.</p>
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
      </section>
      
      <div className="content-grid" style={{marginTop: 32}}>
         <div className="panel tasks-panel glass-panel panel-accent">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-diagram-project text-warning"></i> Course Mapping</h2>
               <button className="text-btn" onClick={loadMappingData} disabled={loadingMappings}>
                  {loadingMappings ? 'Loading...' : 'Refresh'}
               </button>
            </div>
            <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 20}}>
               {!oauthStatus && (
                 <div style={{color: 'var(--warning)', padding: 12, background: 'var(--warning-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning)', fontSize: 14}}>
                    <i className="fa-solid fa-triangle-exclamation"></i> Classroom API is disconnected. Existing mappings can still be edited.
                 </div>
               )}

               <form onSubmit={handleSaveMapping} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
                  <div>
                     <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Classroom Course</label>
                     <select value={selectedClassroomCourse} onChange={event => setSelectedClassroomCourse(event.target.value)} style={{width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}}>
                        <option value="">Select a Classroom course</option>
                        {classroomCourses.map(course => (
                           <option value={course.classroom_id} key={course.classroom_id}>
                              {course.classroom_name || course.classroom_id}{mappedClassroomIds.has(course.classroom_id) ? ' - mapped' : ''}
                           </option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>AcadPulse Course</label>
                     <select value={selectedLocalCourse} onChange={event => setSelectedLocalCourse(event.target.value)} style={{width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}}>
                        <option value="">Select a course</option>
                        {localCourses.map(course => (
                           <option value={course.id} key={course.id}>
                              {course.course_code} - {course.course_name}
                           </option>
                        ))}
                     </select>
                  </div>

                  <button className="btn btn-primary" type="submit" disabled={savingMapping || !selectedClassroomCourse || !selectedLocalCourse}>
                     {savingMapping ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-link"></i> Save Mapping</>}
                  </button>
               </form>

               <form onSubmit={handleSaveManualClassroomCourse} style={{padding: 16, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 12}}>
                  <strong style={{fontSize: 13}}>Add Classroom course manually</strong>
                  <input value={manualClassroomId} onChange={event => setManualClassroomId(event.target.value)} placeholder="Google Classroom course ID" style={{width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
                  <input value={manualClassroomName} onChange={event => setManualClassroomName(event.target.value)} placeholder="Course name optional" style={{width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
                  <button className="btn btn-outline" type="submit" disabled={savingMapping || !manualClassroomId.trim()}>
                     <i className="fa-solid fa-plus"></i> Add Course
                  </button>
               </form>

               {mappingError && (
                  <div style={{color: 'var(--urgent)', padding: 12, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 13}}>
                     <i className="fa-solid fa-triangle-exclamation"></i> {mappingError}
                  </div>
               )}
               {mappingStatus && (
                  <div style={{color: 'var(--success)', padding: 12, background: 'var(--success-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success)', fontSize: 13}}>
                     <i className="fa-solid fa-check"></i> {mappingStatus}
                  </div>
               )}

               <div style={{display: 'flex', justifyContent: 'space-between', background: 'var(--surface-hover)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'}}>
                  <div>
                    <strong style={{fontSize: 32, display: 'block', color: 'var(--warning)'}}>{classroomTasks.length}</strong>
                    <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Active Tasks Extracted</span>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <strong style={{fontSize: 32, display: 'block', color: 'var(--text)'}}>{mappings.length}</strong>
                    <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Courses Mapped</span>
                  </div>
               </div>
            </div>
         </div>
         
         <div className="panel glass-panel panel-accent">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-graduation-cap text-warning"></i> Classroom Polling Logs</h2>
               <span className="badge badge-warning">{classroomNotifs.length} items queued</span>
            </div>
            <div className="notification-stream" style={{padding: '0 24px 24px'}}>
               <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10}}>
                  <strong style={{fontSize: 13, color: 'var(--text-muted)'}}>Saved mappings</strong>
                  {mappings.length === 0 ? (
                     <div style={{fontSize: 13, color: 'var(--text-faint)'}}>No Classroom courses mapped yet.</div>
                  ) : mappings.map(mapping => (
                     <div key={mapping.id} style={{padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', gap: 12}}>
                        <div style={{minWidth: 0}}>
                           <div style={{fontSize: 14, fontWeight: 600}}>{mapping.source_name || mapping.source_reference_id}</div>
                           <div style={{fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere'}}>{mapping.source_reference_id}</div>
                        </div>
                        <span className="badge badge-warning" style={{alignSelf: 'center', whiteSpace: 'nowrap'}}>{mapping.course_code}</span>
                     </div>
                  ))}
               </div>

            {!oauthStatus ? (
               <div style={{color: 'var(--urgent)', padding: 16, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 14}}>
                  <strong>WARNING:</strong> Missing global OAuth tokens. Target stream unavailable.
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
