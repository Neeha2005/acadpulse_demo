import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function WhatsAppIntegration() {
  const { notifications, apiFetch } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);
  const [active, setActive] = useState(true);
  const [groupFilter, setGroupFilter] = useState('All');
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [manualGroupId, setManualGroupId] = useState('');
  const [manualGroupName, setManualGroupName] = useState('');
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingStatus, setMappingStatus] = useState('');
  const [mappingError, setMappingError] = useState('');

  const whatsappNotifs = notifications.filter(n => n.source === 'whatsapp');
  const mappedGroupIds = useMemo(
    () => new Set(mappings.map(mapping => mapping.source_reference_id)),
    [mappings],
  );
  const mappingByGroupId = useMemo(
    () => new Map(mappings.map(mapping => [mapping.source_reference_id, mapping])),
    [mappings],
  );
  const unmappedGroups = useMemo(
    () => groups.filter(group => !mappedGroupIds.has(group.group_id)),
    [groups, mappedGroupIds],
  );
  const visibleGroups = useMemo(
    () => groups.filter(group => {
      if (groupFilter === 'Mapped') return mappedGroupIds.has(group.group_id);
      if (groupFilter === 'Unmapped') return !mappedGroupIds.has(group.group_id);
      return true;
    }),
    [groupFilter, groups, mappedGroupIds],
  );
  const selectedGroupInfo = useMemo(
    () => groups.find(group => group.group_id === selectedGroup),
    [groups, selectedGroup],
  );
  const selectedMapping = selectedGroup ? mappingByGroupId.get(selectedGroup) : null;

  const loadMappingData = useCallback(async () => {
    setLoadingMappings(true);
    setMappingError('');

    try {
      const [coursesPayload, groupsPayload, mappingsPayload] = await Promise.all([
        apiFetch('/courses', {}, false),
        apiFetch('/whatsapp/groups', {}, false),
        apiFetch('/course-source-mappings?source_type=whatsapp', {}, false),
      ]);

      const nextCourses = Array.isArray(coursesPayload?.courses) ? coursesPayload.courses : [];
      const nextGroups = Array.isArray(groupsPayload?.groups) ? groupsPayload.groups : [];
      const nextMappings = Array.isArray(mappingsPayload?.mappings) ? mappingsPayload.mappings : [];

      setCourses(nextCourses);
      setGroups(nextGroups);
      setMappings(nextMappings);
      setSelectedCourse(current => current || nextCourses[0]?.id || '');
      setSelectedGroup(current => {
        if (current && nextGroups.some(group => group.group_id === current)) return current;
        return nextGroups.find(group => !nextMappings.some(mapping => mapping.source_reference_id === group.group_id))?.group_id
          || nextGroups[0]?.group_id
          || '';
      });
    } catch (error) {
      setMappingError(error.message || 'Unable to load WhatsApp mapping data.');
    } finally {
      setLoadingMappings(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMappingData();
  }, [loadMappingData]);

  const handleForceSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
        setIsSyncing(false);
    }, 1500);
  }

  const handleSaveManualGroup = async (event) => {
    event.preventDefault();
    const groupId = manualGroupId.trim();
    if (!groupId) {
      setMappingError('WhatsApp group ID is required.');
      return;
    }

    setSavingMapping(true);
    setMappingError('');
    setMappingStatus('');

    try {
      await apiFetch('/whatsapp/groups', {
        method: 'POST',
        body: JSON.stringify({
          group_id: groupId,
          group_name: manualGroupName.trim() || groupId,
        }),
      }, false);
      setManualGroupId('');
      setManualGroupName('');
      setMappingStatus('Group saved. Select a course to map it.');
      await loadMappingData();
      setSelectedGroup(groupId);
    } catch (error) {
      setMappingError(error.message || 'Unable to save WhatsApp group.');
    } finally {
      setSavingMapping(false);
    }
  };

  const handleSaveMapping = async (event) => {
    event.preventDefault();
    if (!selectedGroup || !selectedCourse) {
      setMappingError('Select both a WhatsApp group and a course.');
      return;
    }

    setSavingMapping(true);
    setMappingError('');
    setMappingStatus('');

    try {
      const payload = await apiFetch('/course-source-mappings', {
        method: 'POST',
        body: JSON.stringify({
          source_type: 'whatsapp',
          source_reference_id: selectedGroup,
          course_id: selectedCourse,
        }),
      }, false);

      setMappings(Array.isArray(payload?.mappings) ? payload.mappings : []);
      setMappingStatus('Mapping saved. Future WhatsApp messages from this group will attach to this course.');
    } catch (error) {
      setMappingError(error.message || 'Unable to save course mapping.');
    } finally {
      setSavingMapping(false);
    }
  };

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
           <div style={{width: 64, height: 64, borderRadius: 16, background: 'var(--whatsapp-subtle)', color: 'var(--whatsapp)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32}}>
              <i className="fa-brands fa-whatsapp"></i>
           </div>
           <div>
              <h1 style={{margin: '0 0 8px 0'}}>WhatsApp Interface</h1>
              <p style={{margin: 0, color: 'var(--text-muted)'}}>Map WhatsApp groups to AcadPulse courses so incoming messages route into the right workload.</p>
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
      </section>
      
      <div className="content-grid" style={{marginTop: 32}}>
         <div className="panel tasks-panel glass-panel panel-accent">
            <div className="panel-header">
               <h2 className="panel-title"><i className="fa-solid fa-diagram-project text-primary"></i> Course Mapping</h2>
               <button className="text-btn" onClick={loadMappingData} disabled={loadingMappings}>
                  {loadingMappings ? 'Loading...' : 'Refresh'}
               </button>
            </div>
            <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 20}}>
               <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12}}>
                  <div style={{padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-hover)'}}>
                     <strong style={{fontSize: 24, display: 'block', color: 'var(--whatsapp)'}}>{groups.length}</strong>
                     <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Detected Groups</span>
                  </div>
                  <div style={{padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-hover)'}}>
                     <strong style={{fontSize: 24, display: 'block', color: 'var(--success)'}}>{mappings.length}</strong>
                     <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Mapped Groups</span>
                  </div>
                  <div style={{padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-hover)'}}>
                     <strong style={{fontSize: 24, display: 'block', color: unmappedGroups.length ? 'var(--warning)' : 'var(--text)'}}>{unmappedGroups.length}</strong>
                     <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Need Course</span>
                  </div>
               </div>

               <form onSubmit={handleSaveMapping} style={{display: 'flex', flexDirection: 'column', gap: 14}}>
                  <div>
                     <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>WhatsApp Group</label>
                     <select value={selectedGroup} onChange={event => setSelectedGroup(event.target.value)} style={{width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}}>
                        <option value="">Select a group</option>
                        {groups.map(group => (
                           <option value={group.group_id} key={group.group_id}>
                              {group.group_name || group.group_id}{mappedGroupIds.has(group.group_id) ? ' - mapped' : ''}
                           </option>
                        ))}
                     </select>
                  </div>

                  {selectedGroup && (
                     <div style={{padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.24)', display: 'flex', justifyContent: 'space-between', gap: 12}}>
                        <div style={{minWidth: 0}}>
                           <div style={{fontSize: 14, fontWeight: 600}}>{selectedGroupInfo?.group_name || selectedGroup}</div>
                           <div style={{fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere'}}>{selectedGroup}</div>
                        </div>
                        <span className={`badge ${selectedMapping ? 'badge-success' : 'badge-warning'}`} style={{alignSelf: 'center', whiteSpace: 'nowrap'}}>
                           {selectedMapping ? selectedMapping.course_code : 'Unmapped'}
                        </span>
                     </div>
                  )}

                  <div>
                     <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Course</label>
                     <select value={selectedCourse} onChange={event => setSelectedCourse(event.target.value)} style={{width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}}>
                        <option value="">Select a course</option>
                        {courses.map(course => (
                           <option value={course.id} key={course.id}>
                              {course.course_code} - {course.course_name}
                           </option>
                        ))}
                     </select>
                  </div>

                  <button className="btn btn-primary" type="submit" disabled={savingMapping || !selectedGroup || !selectedCourse}>
                     {savingMapping ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-link"></i> Save Mapping</>}
                  </button>
               </form>

               <form onSubmit={handleSaveManualGroup} style={{padding: 16, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 12}}>
                  <strong style={{fontSize: 13}}>Add group manually</strong>
                  <input value={manualGroupId} onChange={event => setManualGroupId(event.target.value)} placeholder="120363418273@g.us" style={{width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
                  <input value={manualGroupName} onChange={event => setManualGroupName(event.target.value)} placeholder="Group name optional" style={{width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
                  <button className="btn btn-outline" type="submit" disabled={savingMapping || !manualGroupId.trim()}>
                     <i className="fa-solid fa-plus"></i> Add Group
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

               <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
                     <strong style={{fontSize: 13, color: 'var(--text-muted)'}}>Group coverage</strong>
                     <div className="filters glass-pill-group" style={{flexWrap: 'wrap'}}>
                        {['All', 'Mapped', 'Unmapped'].map(filter => (
                           <button key={filter} className={`filter-btn glass-filter-pill ${groupFilter === filter ? 'active' : ''}`} type="button" onClick={() => setGroupFilter(filter)}>
                              {filter}
                           </button>
                        ))}
                     </div>
                  </div>
                  {visibleGroups.length === 0 ? (
                     <div style={{fontSize: 13, color: 'var(--text-faint)'}}>No WhatsApp groups match this filter.</div>
                  ) : visibleGroups.map(group => {
                     const mapping = mappingByGroupId.get(group.group_id);
                     return (
                        <button key={group.group_id} type="button" onClick={() => {
                           setSelectedGroup(group.group_id);
                           if (mapping?.course_id) setSelectedCourse(mapping.course_id);
                        }} style={{padding: 12, borderRadius: 'var(--radius-sm)', border: selectedGroup === group.group_id ? '1px solid var(--whatsapp)' : '1px solid var(--border)', background: selectedGroup === group.group_id ? 'var(--whatsapp-subtle)' : 'var(--bg)', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text)', textAlign: 'left', cursor: 'pointer'}}>
                           <div style={{minWidth: 0}}>
                              <div style={{fontSize: 14, fontWeight: 600}}>{group.group_name || group.group_id}</div>
                              <div style={{fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere'}}>{group.group_id}</div>
                           </div>
                           <span className={`badge ${mapping ? 'badge-success' : 'badge-warning'}`} style={{alignSelf: 'center', whiteSpace: 'nowrap'}}>
                              {mapping ? mapping.course_code : 'Map'}
                           </span>
                        </button>
                     );
                  })}
               </div>
            </div>
         </div>
         
         <div className="panel glass-panel panel-accent">
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
