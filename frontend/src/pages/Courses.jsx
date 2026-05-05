import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';

function aliasesToText(aliases) {
  return (aliases || []).join(', ');
}

function textToAliases(text) {
  return (text || '')
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean);
}

export default function Courses() {
  const { apiFetch } = useAppContext();
  const [courses, setCourses] = useState([]);
  const [aliasDrafts, setAliasDrafts] = useState({});
  const [newCourse, setNewCourse] = useState({
    course_code: '',
    course_name: '',
    aliases: '',
  });
  const [ambiguityForm, setAmbiguityForm] = useState({
    message: '',
    group_name: '',
    source_type: 'whatsapp',
    source_reference_id: '',
    course_id: '',
    alias: '',
    save_alias: true,
  });
  const [classificationResult, setClassificationResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const payload = await apiFetch('/courses', {}, false);
      const nextCourses = Array.isArray(payload?.courses) ? payload.courses : [];
      setCourses(nextCourses);
      setAmbiguityForm((current) => ({
        ...current,
        course_id: current.course_id || nextCourses[0]?.id || '',
      }));
      setAliasDrafts(Object.fromEntries(
        nextCourses.map((course) => [course.id, aliasesToText(course.aliases)]),
      ));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load courses.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCourses();
  }, [loadCourses]);

  const totalAliases = useMemo(
    () => courses.reduce((sum, course) => sum + (course.aliases?.length || 0), 0),
    [courses],
  );

  const coursesWithoutAliases = useMemo(
    () => courses.filter((course) => !course.aliases || course.aliases.length === 0),
    [courses],
  );

  const updateCourseInState = (updatedCourse) => {
    setCourses((current) => {
      const exists = current.some((course) => course.id === updatedCourse.id);
      const nextCourses = exists
        ? current.map((course) => (course.id === updatedCourse.id ? updatedCourse : course))
        : [...current, updatedCourse];
      return nextCourses.sort((a, b) => `${a.course_code}`.localeCompare(`${b.course_code}`));
    });
    setAliasDrafts((current) => ({
      ...current,
      [updatedCourse.id]: aliasesToText(updatedCourse.aliases),
    }));
  };

  const handleSaveAliases = async (course) => {
    setSavingId(course.id);
    setStatus('');
    setError('');

    try {
      const payload = await apiFetch(`/courses/${course.id}/aliases`, {
        method: 'PATCH',
        body: JSON.stringify({
          aliases: textToAliases(aliasDrafts[course.id]),
        }),
      }, false);
      if (payload?.course) {
        updateCourseInState(payload.course);
      }
      setStatus(`Aliases saved for ${course.course_code}.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save aliases.');
    } finally {
      setSavingId('');
    }
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();
    const courseCode = newCourse.course_code.trim();
    const courseName = newCourse.course_name.trim();

    if (!courseCode || !courseName) {
      setError('Course code and course name are required.');
      return;
    }

    setSavingId('new-course');
    setStatus('');
    setError('');

    try {
      const payload = await apiFetch('/courses', {
        method: 'POST',
        body: JSON.stringify({
          course_code: courseCode,
          course_name: courseName,
          aliases: textToAliases(newCourse.aliases),
        }),
      }, false);
      if (payload?.course) {
        updateCourseInState(payload.course);
      }
      setNewCourse({ course_code: '', course_name: '', aliases: '' });
      setStatus(`${courseCode} saved to the abbreviation dictionary.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save course.');
    } finally {
      setSavingId('');
    }
  };

  const handleClassifyAmbiguity = async (event) => {
    event.preventDefault();
    const message = ambiguityForm.message.trim();

    if (!message) {
      setError('Message text is required before classification.');
      return;
    }

    setClassifying(true);
    setClassificationResult(null);
    setStatus('');
    setError('');

    try {
      const payload = await apiFetch('/messages/classify-course', {
        method: 'POST',
        body: JSON.stringify({
          message,
          group_name: ambiguityForm.group_name.trim() || null,
        }),
      }, false);

      setClassificationResult(payload);
      if (payload?.course_id) {
        setAmbiguityForm((current) => ({
          ...current,
          course_id: payload.course_id,
        }));
      }
    } catch (classifyError) {
      setError(classifyError.message || 'Unable to classify this message.');
    } finally {
      setClassifying(false);
    }
  };

  const handleResolveAmbiguity = async () => {
    const message = ambiguityForm.message.trim();
    const courseId = ambiguityForm.course_id.trim();

    if (!message || !courseId) {
      setError('Message and confirmed course are required.');
      return;
    }

    setResolving(true);
    setStatus('');
    setError('');

    try {
      const payload = await apiFetch('/messages/resolve-course-ambiguity', {
        method: 'POST',
        body: JSON.stringify({
          message,
          group_name: ambiguityForm.group_name.trim() || null,
          source_type: ambiguityForm.source_type,
          source_reference_id: ambiguityForm.source_reference_id.trim() || null,
          course_id: courseId,
          alias: ambiguityForm.alias.trim() || null,
          save_alias: ambiguityForm.save_alias,
        }),
      }, false);

      if (payload?.course) {
        updateCourseInState(payload.course);
      }
      setClassificationResult(payload?.classification || null);
      setStatus('Ambiguity resolved and classifier memory updated.');
      setAmbiguityForm((current) => ({
        ...current,
        alias: '',
      }));
    } catch (resolveError) {
      setError(resolveError.message || 'Unable to resolve this ambiguity.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">COURSE ROSTER</span>
          <h1 className="hero-title">Abbreviation Dictionary</h1>
          <p>
            Teach AcadPulse course short forms like OS, DSA, DBMS, AI, and SE so WhatsApp, Gmail, and Classroom messages map cleanly.
          </p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Need Aliases</span>
            <strong>{coursesWithoutAliases.length}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Courses</span>
            <strong>{courses.length}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Aliases</span>
            <strong>{totalAliases}</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-pending"><i className="fa-solid fa-book"></i></div>
            <div className="stat-trend trend-pill trend-pill-pending">classification base</div>
          </div>
          <div className="stat-value stat-value-pending">{courses.length}</div>
          <div className="stat-label">Courses</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-messages"><i className="fa-solid fa-tags"></i></div>
            <div className="stat-trend trend-pill trend-pill-messages">known short forms</div>
          </div>
          <div className="stat-value stat-value-messages">{totalAliases}</div>
          <div className="stat-label">Saved Aliases</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-urgent"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <div className="stat-trend trend-pill trend-pill-urgent">mapping risk</div>
          </div>
          <div className="stat-value stat-value-urgent">{coursesWithoutAliases.length}</div>
          <div className="stat-label">Without Aliases</div>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel tasks-panel glass-panel panel-accent">
          <div className="panel-header">
            <div>
              <h2 className="panel-title"><i className="fa-solid fa-plus text-primary"></i> Add Course</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Existing course codes are updated instead of duplicated.
              </p>
            </div>
          </div>
          <form onSubmit={handleCreateCourse} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              value={newCourse.course_code}
              onChange={(event) => setNewCourse((current) => ({ ...current, course_code: event.target.value }))}
              placeholder="Course code, e.g. CS301"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <input
              value={newCourse.course_name}
              onChange={(event) => setNewCourse((current) => ({ ...current, course_name: event.target.value }))}
              placeholder="Course name, e.g. Operating Systems"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <input
              value={newCourse.aliases}
              onChange={(event) => setNewCourse((current) => ({ ...current, aliases: event.target.value }))}
              placeholder="Aliases, comma-separated: OS, Ops Sys, Operating System"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <button className="btn btn-primary" type="submit" disabled={savingId === 'new-course'}>
              {savingId === 'new-course' ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-floppy-disk"></i> Save Course</>}
            </button>
          </form>
        </div>

        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <div>
              <h2 className="panel-title"><i className="fa-solid fa-tags text-primary"></i> Alias Editor</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                These aliases are used by exact, fuzzy, and LLM course matching.
              </p>
            </div>
            <button className="text-btn gradient-link" onClick={loadCourses} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="tasks-list" style={{ padding: 24 }}>
            {error && (
              <div style={{ color: 'var(--urgent)', padding: 12, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 13 }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {error}
              </div>
            )}
            {status && (
              <div style={{ color: 'var(--success)', padding: 12, background: 'var(--success-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success)', fontSize: 13 }}>
                <i className="fa-solid fa-check"></i> {status}
              </div>
            )}

            {loading ? (
              <div className="empty-state glass-empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-circle-notch fa-spin"></i></div>
                <p>Loading courses</p>
              </div>
            ) : courses.length === 0 ? (
              <div className="empty-state glass-empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-book-open"></i></div>
                <p>No courses saved yet</p>
              </div>
            ) : courses.map((course) => (
              <div key={course.id} className="task-card" style={{ cursor: 'default' }}>
                <div className="task-top">
                  <span className="task-course">{course.course_code}</span>
                  <span className="task-due"><i className="fa-solid fa-tags"></i> {course.aliases?.length || 0}</span>
                </div>
                <h3 className="task-title">{course.course_name}</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={aliasDrafts[course.id] || ''}
                    onChange={(event) => setAliasDrafts((current) => ({ ...current, [course.id]: event.target.value }))}
                    placeholder="Add aliases separated by commas"
                    style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                  <button className="btn btn-outline" type="button" onClick={() => handleSaveAliases(course)} disabled={savingId === course.id}>
                    {savingId === course.id ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title"><i className="fa-solid fa-route text-primary"></i> Ambiguity Resolution</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Test uncertain messages, confirm the right course, and save the lesson for future matching.
            </p>
          </div>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 18 }}>
          <form onSubmit={handleClassifyAmbiguity} style={{ display: 'grid', gap: 14 }}>
            <textarea
              value={ambiguityForm.message}
              onChange={(event) => setAmbiguityForm((current) => ({ ...current, message: event.target.value }))}
              placeholder="Paste an ambiguous message, e.g. OS quiz shifted to Friday"
              rows={4}
              style={{ width: '100%', resize: 'vertical', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <input
                value={ambiguityForm.group_name}
                onChange={(event) => setAmbiguityForm((current) => ({ ...current, group_name: event.target.value }))}
                placeholder="Source name, e.g. CS301 Group"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <select
                value={ambiguityForm.source_type}
                onChange={(event) => setAmbiguityForm((current) => ({ ...current, source_type: event.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="gmail">Gmail</option>
                <option value="classroom">Classroom</option>
              </select>
              <input
                value={ambiguityForm.source_reference_id}
                onChange={(event) => setAmbiguityForm((current) => ({ ...current, source_reference_id: event.target.value }))}
                placeholder="Source ID to map, optional"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </div>

            <button className="btn btn-outline" type="submit" disabled={classifying}>
              {classifying ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Classifying...</> : <><i className="fa-solid fa-wand-magic-sparkles"></i> Classify Message</>}
            </button>
          </form>

          {classificationResult && (
            <div className="task-card" style={{ cursor: 'default' }}>
              <div className="task-top">
                <span className="task-course">{classificationResult.method}</span>
                <span className="task-due">
                  <i className="fa-solid fa-gauge-high"></i> {Math.round((classificationResult.confidence || 0) * 100)}%
                </span>
              </div>
              <h3 className="task-title">
                {classificationResult.course_name || 'No confident course match'}
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                {classificationResult.requires_user_confirmation
                  ? 'Human confirmation required before this mapping should be trusted.'
                  : 'High confidence match. You can still confirm it to save a source mapping or alias.'}
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
            <select
              value={ambiguityForm.course_id}
              onChange={(event) => setAmbiguityForm((current) => ({ ...current, course_id: event.target.value }))}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            >
              <option value="">Select confirmed course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>
            <input
              value={ambiguityForm.alias}
              onChange={(event) => setAmbiguityForm((current) => ({ ...current, alias: event.target.value }))}
              placeholder="Alias to learn, e.g. OS"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={ambiguityForm.save_alias}
                onChange={(event) => setAmbiguityForm((current) => ({ ...current, save_alias: event.target.checked }))}
              />
              Save alias
            </label>
            <button className="btn btn-primary" type="button" onClick={handleResolveAmbiguity} disabled={resolving || courses.length === 0}>
              {resolving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-check"></i> Confirm Mapping</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
