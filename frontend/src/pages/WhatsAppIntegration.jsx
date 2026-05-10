import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AttachmentList from '../components/AttachmentList';
import { useAppContext } from '../context/AppContext';

export default function WhatsAppIntegration() {
  const { notifications, apiFetch, authUser, user } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);
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
  const [waStatus, setWaStatus] = useState({ status: 'unknown' });
  const [qrState, setQrState] = useState({ loading: false, value: '', error: '' });
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [detectedGroups, setDetectedGroups] = useState([]);
  const [selectedDetectedGroupIds, setSelectedDetectedGroupIds] = useState(() => new Set());
  const [savingGroupSelection, setSavingGroupSelection] = useState(false);
  const lastQrRef = useRef('');
  const lastQrUpdatedAtRef = useRef('');

  const whatsappNotifs = notifications.filter(n => n.source === 'whatsapp');
  const mappedGroupIds = useMemo(() => new Set(mappings.map(m => m.source_reference_id)), [mappings]);
  const mappingByGroupId = useMemo(() => new Map(mappings.map(m => [m.source_reference_id, m])), [mappings]);
  const unmappedGroups = useMemo(() => groups.filter(g => !mappedGroupIds.has(g.group_id)), [groups, mappedGroupIds]);
  const visibleGroups = useMemo(() => groups.filter(g => {
    if (groupFilter === 'Mapped') return mappedGroupIds.has(g.group_id);
    if (groupFilter === 'Unmapped') return !mappedGroupIds.has(g.group_id);
    return true;
  }), [groupFilter, groups, mappedGroupIds]);
  const selectedGroupInfo = useMemo(() => groups.find(g => g.group_id === selectedGroup), [groups, selectedGroup]);
  const selectedMapping = selectedGroup ? mappingByGroupId.get(selectedGroup) : null;
  const userId = authUser?.id || user?.id || localStorage.getItem('acadpulse_user_id') || '';
  const userQuery = userId ? `user_id=${encodeURIComponent(userId)}` : '';
  const withUserQuery = useCallback((path) => {
    if (!userQuery) return path;
    return `${path}${path.includes('?') ? '&' : '?'}${userQuery}`;
  }, [userQuery]);

  const loadWaStatus = useCallback(async () => {
    try {
      const payload = await apiFetch(withUserQuery('/whatsapp/status'), {}, false);
      setWaStatus(payload?.whatsapp || { status: 'unknown' });
      if (payload?.whatsapp?.status === 'qr_required') setShowQrPanel(true);
    } catch {
      setWaStatus({ status: 'unknown' });
    }
  }, [apiFetch, withUserQuery]);

  const loadMappingData = useCallback(async () => {
    setLoadingMappings(true);
    setMappingError('');
    try {
      const [coursesPayload, groupsPayload, mappingsPayload] = await Promise.all([
        apiFetch(withUserQuery('/courses'), {}, false),
        apiFetch(withUserQuery('/whatsapp/groups'), {}, false),
        apiFetch(withUserQuery('/course-source-mappings?source_type=whatsapp'), {}, false),
      ]);
      const nextCourses = Array.isArray(coursesPayload?.courses) ? coursesPayload.courses : [];
      const nextGroups = Array.isArray(groupsPayload?.groups) ? groupsPayload.groups : [];
      const nextMappings = Array.isArray(mappingsPayload?.mappings) ? mappingsPayload.mappings : [];
      setCourses(nextCourses);
      setGroups(nextGroups);
      setMappings(nextMappings);
      setSelectedCourse(current => current || nextCourses[0]?.id || '');
      setSelectedGroup(current => {
        if (current && nextGroups.some(g => g.group_id === current)) return current;
        return nextGroups.find(g => !nextMappings.some(m => m.source_reference_id === g.group_id))?.group_id || nextGroups[0]?.group_id || '';
      });
    } catch (error) {
      setMappingError(error.message || 'Unable to load WhatsApp mapping data.');
    } finally {
      setLoadingMappings(false);
    }
  }, [apiFetch, withUserQuery]);

  const loadDetectedGroups = useCallback(async () => {
    if (!userId) return;
    try {
      const payload = await apiFetch(withUserQuery('/whatsapp/groups/detected'), {}, false);
      const nextGroups = Array.isArray(payload?.groups) ? payload.groups : [];
      setDetectedGroups(nextGroups);
      setSelectedDetectedGroupIds(new Set(nextGroups.filter(group => group.is_selected).map(group => group.group_id)));
    } catch {
      setDetectedGroups([]);
    }
  }, [apiFetch, userId, withUserQuery]);

  const loadQrCode = useCallback(async () => {
  setQrState(prev => ({ ...prev, loading: !prev.value }));
  try {
    const payload = await apiFetch(withUserQuery('/whatsapp/qr'), {}, false);
    const rawQr = payload?.qr || '';
    if (rawQr && rawQr !== lastQrRef.current) {
      lastQrRef.current = rawQr;
      const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(rawQr)}`;
      setQrState({ loading: false, value: qrImage, error: '' });
    } else if (!rawQr) {
      if (payload?.status === 'connected') {
        setQrState({ loading: false, value: '', error: '' });
      } else {
        setQrState(prev => ({
          ...prev,
          loading: false,
          error: prev.value ? '' : (payload?.message || 'QR code not available yet. Start the WhatsApp bridge and wait a few seconds.'),
        }));
      }
    } else {
      setQrState(prev => ({ ...prev, loading: false }));
    }
  } catch {
    setQrState(prev => ({ ...prev, loading: false, error: 'QR code not available. Start the WhatsApp bridge and wait a few seconds.' }));
  }
}, [apiFetch, withUserQuery]);

  const isConnected = waStatus.status === 'connected' || waStatus.status === 'open';

  const statusColor = isConnected ? 'var(--success)'
    : waStatus.status === 'qr_required' ? 'var(--warning)'
    : waStatus.status === 'disconnected' ? 'var(--urgent)'
    : 'var(--text-muted)';

  const statusLabel = isConnected ? 'Connected'
    : waStatus.status === 'qr_required' ? 'Waiting for QR scan'
    : waStatus.status === 'disconnected' ? 'Disconnected'
    : 'Unknown';

  useEffect(() => {
    loadWaStatus();
    loadMappingData();
    loadDetectedGroups();
  }, [loadWaStatus, loadMappingData, loadDetectedGroups]);

  useEffect(() => {
  if (!showQrPanel || isConnected || !userId) return undefined;

  loadQrCode();

  const statusPoll = window.setInterval(async () => {
    try {
      const payload = await apiFetch(withUserQuery('/whatsapp/status'), {}, false);
      const waData = payload?.whatsapp || {};
      setWaStatus(waData);

      if (
        waData.status === 'qr_required' &&
        waData.qr_updated_at &&
        waData.qr_updated_at !== lastQrUpdatedAtRef.current
      ) {
        lastQrUpdatedAtRef.current = waData.qr_updated_at;
        loadQrCode();
      }
    } catch {
      // silent
    }
  }, 3000);

  return () => window.clearInterval(statusPoll);
}, [showQrPanel, isConnected, userId, apiFetch, withUserQuery, loadQrCode]);

useEffect(() => {
  if (!showQrPanel || isConnected) return undefined;
  if (!qrState.value) return undefined;

  const expiryTimer = window.setTimeout(() => {
    setQrState(prev => ({ ...prev, loading: true }));
  }, 20_000);

  return () => window.clearTimeout(expiryTimer);
}, [qrState.value, showQrPanel, isConnected]);
  useEffect(() => {
    if (isConnected) {
      setShowQrPanel(false);
      setQrState({ loading: false, value: '', error: '' });
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      loadMappingData();
      loadDetectedGroups();
      return;
    }
    setGroups([]);
    setMappings([]);
    setDetectedGroups([]);
    setSelectedDetectedGroupIds(new Set());
    setSelectedGroup('');
    setMappingStatus('');
  }, [isConnected, loadDetectedGroups, loadMappingData]);

  const toggleDetectedGroup = (groupId) => {
    setSelectedDetectedGroupIds(current => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const saveDetectedGroupSelection = async () => {
    if (!userId) return;
    setSavingGroupSelection(true);
    setMappingError('');
    setMappingStatus('');
    try {
      await apiFetch('/whatsapp/groups/selection', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, group_ids: Array.from(selectedDetectedGroupIds) }),
      }, false);
      setMappingStatus('WhatsApp group selection saved.');
      await loadDetectedGroups();
      await loadMappingData();
    } catch (error) {
      setMappingError(error.message || 'Unable to save WhatsApp group selection.');
    } finally {
      setSavingGroupSelection(false);
    }
  };

  const handleForceSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleSaveManualGroup = async (event) => {
    event.preventDefault();
    const groupId = manualGroupId.trim();
    if (!groupId) { setMappingError('WhatsApp group ID is required.'); return; }
    setSavingMapping(true);
    setMappingError('');
    setMappingStatus('');
    try {
      await apiFetch('/whatsapp/groups', {
        method: 'POST',
        body: JSON.stringify({ ...(userId ? { user_id: userId } : {}), group_id: groupId, group_name: manualGroupName.trim() || groupId, selected: true }),
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
    if (!selectedGroup || !selectedCourse) { setMappingError('Select both a WhatsApp group and a course.'); return; }
    setSavingMapping(true);
    setMappingError('');
    setMappingStatus('');
    try {
      const payload = await apiFetch('/course-source-mappings', {
        method: 'POST',
        body: JSON.stringify({ ...(userId ? { user_id: userId } : {}), source_type: 'whatsapp', source_reference_id: selectedGroup, course_id: selectedCourse }),
      }, false);
      setMappings(Array.isArray(payload?.mappings) ? payload.mappings : []);
      setMappingStatus('Mapping saved. Future messages from this group will attach to this course.');
    } catch (error) {
      setMappingError(error.message || 'Unable to save course mapping.');
    } finally {
      setSavingMapping(false);
    }
  };

  return (
    <div className="dashboard-scroll integration-page">
      <section className="hero-stats glass-banner">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--whatsapp-subtle)', color: 'var(--whatsapp)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            <i className="fa-brands fa-whatsapp"></i>
          </div>
          <div>
            <h1 style={{ margin: '0 0 8px 0' }}>WhatsApp Interface</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Map WhatsApp groups to AcadPulse courses so incoming messages route into the right workload.
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', fontSize: 13 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }}></div>
              <span style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            {!isConnected && (
              <button
                className="btn btn-outline"
                onClick={() => { setShowQrPanel(!showQrPanel); if (!showQrPanel) loadQrCode(); }}
              >
                <i className="fa-solid fa-qrcode"></i> {showQrPanel ? 'Hide QR' : 'Show QR Code'}
              </button>
            )}
            <button className="btn btn-primary" onClick={handleForceSync} disabled={isSyncing || !isConnected}>
              {isSyncing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing...</> : 'Force Data Pull'}
            </button>
          </div>
        </div>
      </section>

      {/* QR Code Panel */}
      {showQrPanel && !isConnected && (
        <div className="panel glass-panel panel-accent" style={{ marginTop: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-qrcode text-whatsapp"></i> Scan to Connect WhatsApp</h2>
            <button className="text-btn" onClick={loadQrCode}>Refresh QR</button>
          </div>
          <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ flexShrink: 0 }}>
              {qrState.loading ? (
                <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 8 }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 32, color: 'var(--text-muted)' }}></i>
                </div>
              ) : qrState.value ? (
                <img src={qrState.value} alt="WhatsApp QR Code" style={{ width: 240, height: 240, borderRadius: 8, background: '#fff', padding: 8 }} />
              ) : (
                <div style={{ width: 240, height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 8, gap: 12, padding: 16, textAlign: 'center' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 32, color: 'var(--warning)' }}></i>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{qrState.error}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <strong style={{ fontSize: 15 }}>Connect your WhatsApp</strong>
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2, color: 'var(--text-muted)', fontSize: 13 }}>
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>Go to <strong>Settings → Linked Devices</strong></li>
                <li>Tap <strong>Link a Device</strong></li>
                <li>Scan this QR code</li>
              </ol>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
                QR codes expire every 60 seconds. Keep this panel open while AcadPulse requests a fresh code from the WhatsApp bridge.
              </p>
              <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={loadQrCode}>
                <i className="fa-solid fa-rotate"></i> Refresh QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {isConnected && detectedGroups.length > 0 && (
        <div className="panel glass-panel panel-accent" style={{ marginTop: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-brands fa-whatsapp text-whatsapp"></i> Select WhatsApp Groups</h2>
            <span className="badge badge-success">{selectedDetectedGroupIds.size} selected</span>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 10, maxHeight: 300, overflow: 'auto' }}>
              {detectedGroups.map(group => (
                <label key={group.group_id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 10, alignItems: 'center', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
                  <input
                    type="checkbox"
                    checked={selectedDetectedGroupIds.has(group.group_id)}
                    onChange={() => toggleDetectedGroup(group.group_id)}
                  />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 14 }}>{group.group_name || group.group_id}</strong>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{group.group_id}</span>
                  </span>
                </label>
              ))}
            </div>
            <button className="btn btn-primary" type="button" onClick={saveDetectedGroupSelection} disabled={savingGroupSelection}>
              {savingGroupSelection ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-check"></i> Save Selected Groups</>}
            </button>
          </div>
        </div>
      )}

      <div className="content-grid" style={{ marginTop: showQrPanel && !isConnected ? 0 : 32 }}>
        <div className="panel tasks-panel glass-panel panel-accent">
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-diagram-project text-primary"></i> Course Mapping</h2>
            <button className="text-btn" onClick={loadMappingData} disabled={loadingMappings}>
              {loadingMappings ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
                <strong style={{ fontSize: 24, display: 'block', color: 'var(--whatsapp)' }}>{groups.length}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Detected Groups</span>
              </div>
              <div style={{ padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
                <strong style={{ fontSize: 24, display: 'block', color: 'var(--success)' }}>{mappings.length}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mapped Groups</span>
              </div>
              <div style={{ padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
                <strong style={{ fontSize: 24, display: 'block', color: unmappedGroups.length ? 'var(--warning)' : 'var(--text)' }}>{unmappedGroups.length}</strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Need Course</span>
              </div>
            </div>

            <form onSubmit={handleSaveMapping} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>WhatsApp Group</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">Select a group</option>
                  {groups.map(group => (
                    <option value={group.group_id} key={group.group_id}>
                      {group.group_name || group.group_id}{mappedGroupIds.has(group.group_id) ? ' — mapped' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedGroup && (
                <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.24)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedGroupInfo?.group_name || selectedGroup}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{selectedGroup}</div>
                  </div>
                  <span className={`badge ${selectedMapping ? 'badge-success' : 'badge-warning'}`} style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>
                    {selectedMapping ? selectedMapping.course_code : 'Unmapped'}
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Course</label>
                <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option value={course.id} key={course.id}>{course.course_code} — {course.course_name}</option>
                  ))}
                </select>
              </div>

              <button className="btn btn-primary" type="submit" disabled={savingMapping || !selectedGroup || !selectedCourse}>
                {savingMapping ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-link"></i> Save Mapping</>}
              </button>
            </form>

            <form onSubmit={handleSaveManualGroup} style={{ padding: 16, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <strong style={{ fontSize: 13 }}>Add group manually</strong>
              <input value={manualGroupId} onChange={e => setManualGroupId(e.target.value)} placeholder="120363418273@g.us" style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
              <input value={manualGroupName} onChange={e => setManualGroupName(e.target.value)} placeholder="Group name (optional)" style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
              <button className="btn btn-outline" type="submit" disabled={savingMapping || !manualGroupId.trim()}>
                <i className="fa-solid fa-plus"></i> Add Group
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <strong style={{ fontSize: 13, color: 'var(--text-muted)' }}>Group coverage</strong>
                <div className="filters glass-pill-group" style={{ flexWrap: 'wrap' }}>
                  {['All', 'Mapped', 'Unmapped'].map(filter => (
                    <button key={filter} className={`filter-btn glass-filter-pill ${groupFilter === filter ? 'active' : ''}`} type="button" onClick={() => setGroupFilter(filter)}>
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              {visibleGroups.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                  {groups.length === 0
                    ? 'No WhatsApp groups detected yet. Connect WhatsApp above or add a group manually.'
                    : 'No groups match this filter.'}
                </div>
              ) : visibleGroups.map(group => {
                const mapping = mappingByGroupId.get(group.group_id);
                return (
                  <button key={group.group_id} type="button" onClick={() => { setSelectedGroup(group.group_id); if (mapping?.course_id) setSelectedCourse(mapping.course_id); }} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: selectedGroup === group.group_id ? '1px solid var(--whatsapp)' : '1px solid var(--border)', background: selectedGroup === group.group_id ? 'var(--whatsapp-subtle)' : 'var(--bg)', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{group.group_name || group.group_id}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{group.group_id}</div>
                    </div>
                    <span className={`badge ${mapping ? 'badge-success' : 'badge-warning'}`} style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>
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
          <div className="notification-stream" style={{ padding: '0 24px 24px' }}>
            {!isConnected ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
                <i className="fa-brands fa-whatsapp" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }}></i>
                <div>Connect WhatsApp to see messages here.</div>
                <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-faint)' }}>Click "Show QR Code" above and scan with your phone.</div>
              </div>
            ) : whatsappNotifs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No messages yet. Send a test message in one of your mapped WhatsApp groups.</div>
            ) : (
              whatsappNotifs.map(n => (
                <div className="notif-item" key={n.id}>
                  <div className="notif-icon-wrap whatsapp" style={{ background: 'var(--surface-hover)' }}>
                    <i className="fa-brands fa-whatsapp text-whatsapp"></i>
                  </div>
                  <div className="notif-content">
                    <div className="notif-header">
                      <span className="notif-sender">{n.sender}</span>
                      {n.attachmentCount > 0 && <span className="source-mini-badge" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>{n.attachmentCount} file{n.attachmentCount === 1 ? '' : 's'}</span>}
                      <span className="notif-time">{n.time}</span>
                    </div>
                    <h4 className="notif-title">{n.title}</h4>
                    <p className="notif-preview">{n.preview}</p>
                    <AttachmentList attachments={n.attachments} compact />
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