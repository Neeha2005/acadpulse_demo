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

const EMPTY_COURSE = {
  course_code: '',
  short_name: '',
  course_name: '',
  aliases: '',
};

export default function Courses() {
  const { apiFetch, authUser, user } = useAppContext();
  const [courses, setCourses] = useState([]);
  const [aliasDrafts, setAliasDrafts] = useState({});
  const [newCourse, setNewCourse] = useState(EMPTY_COURSE);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const userId = authUser?.id || user?.id || localStorage.getItem('acadpulse_user_id') || '';
  const userQuery = userId ? `?user_id=${encodeURIComponent(userId)}` : '';

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const payload = await apiFetch(`/courses${userQuery}`, {}, false);
      const nextCourses = Array.isArray(payload?.courses) ? payload.courses : [];
      setCourses(nextCourses);
      setAliasDrafts(Object.fromEntries(
        nextCourses.map((course) => [course.id, aliasesToText(course.aliases)]),
      ));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load courses.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, userQuery]);

  useEffect(() => {
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
          user_id: userId,
          aliases: textToAliases(aliasDrafts[course.id]),
        }),
      }, false);
      if (payload?.course) {
        updateCourseInState(payload.course);
      }
      setStatus(`${course.course_code} aliases saved.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save aliases.');
    } finally {
      setSavingId('');
    }
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();
    const courseCode = newCourse.course_code.trim();
    const shortName = newCourse.short_name.trim();
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
          short_name: shortName,
          course_name: courseName,
          aliases: textToAliases(newCourse.aliases),
          user_id: userId,
        }),
      }, false);
      if (payload?.course) {
        updateCourseInState(payload.course);
      }
      setNewCourse(EMPTY_COURSE);
      setStatus(`${courseCode} saved.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save course.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="dashboard-scroll courses-page">
      <section className="courses-hero glass-banner">
        <div className="courses-hero-copy">
          <span className="hero-kicker">COURSES</span>
          <h1 className="hero-title">Course Library</h1>
          <p className="courses-hero-text">
            Keep course codes, names, and short forms clean so incoming messages map correctly.
          </p>
          <div className="courses-hero-signals">
            <span className="courses-hero-signal"><i className="fa-solid fa-brain"></i> Smart Mapping</span>
            <span className="courses-hero-signal"><i className="fa-solid fa-magnifying-glass-chart"></i> Alias Detection</span>
            <span className="courses-hero-signal"><i className="fa-solid fa-circle-nodes"></i> Connected Subjects</span>
          </div>
        </div>

        <div className="courses-hero-visual">
          <div className="courses-visual-ambient ambient-indigo"></div>
          <div className="courses-visual-ambient ambient-cyan"></div>
          <div className="courses-visual-grid"></div>
          <div className="courses-orbit orbit-one"></div>
          <div className="courses-orbit orbit-two"></div>
          <div className="courses-orbit orbit-three"></div>
          <div className="courses-link-line line-one"></div>
          <div className="courses-link-line line-two"></div>
          <div className="courses-link-line line-three"></div>
          <div className="courses-node node-a"></div>
          <div className="courses-node node-b"></div>
          <div className="courses-node node-c"></div>
          <div className="courses-node node-d"></div>
          <div className="courses-node node-e"></div>
          <div className="courses-particle particle-one"></div>
          <div className="courses-particle particle-two"></div>
          <div className="courses-particle particle-three"></div>

          <div className="courses-mapping-core">
            <div className="courses-mapping-core-ring ring-a"></div>
            <div className="courses-mapping-core-ring ring-b"></div>
            <div className="courses-mapping-core-base"></div>
            <div className="courses-mapping-card main">
              <i className="fa-solid fa-layer-group"></i>
            </div>
          </div>

          <div className="courses-subject-chip chip-one">
            <span className="courses-chip-icon"><i className="fa-solid fa-graduation-cap"></i></span>
            <span className="courses-chip-copy">
              <strong>CS301</strong>
            </span>
            <span className="courses-chip-dot"></span>
          </div>
          <div className="courses-subject-chip chip-two">
            <span className="courses-chip-icon"><i className="fa-solid fa-book-open-reader"></i></span>
            <span className="courses-chip-copy">
              <strong>OS</strong>
            </span>
            <span className="courses-chip-dot"></span>
          </div>
          <div className="courses-subject-chip chip-three">
            <span className="courses-chip-icon"><i className="fa-solid fa-brain"></i></span>
            <span className="courses-chip-copy">
              <strong>AI101</strong>
            </span>
            <span className="courses-chip-dot"></span>
          </div>
          <div className="courses-subject-chip chip-four">
            <span className="courses-chip-icon"><i className="fa-solid fa-database"></i></span>
            <span className="courses-chip-copy">
              <strong>DBMS</strong>
            </span>
            <span className="courses-chip-dot"></span>
          </div>
          <div className="courses-subject-chip chip-five">
            <span className="courses-chip-icon"><i className="fa-solid fa-wand-magic-sparkles"></i></span>
            <span className="courses-chip-copy">
              <strong>AI</strong>
            </span>
            <span className="courses-chip-dot"></span>
          </div>

          <div className="courses-visual-chip chip-connected">
            <i className="fa-solid fa-chart-line"></i>
            <div>
              <strong>4 Connected</strong>
            </div>
          </div>
        </div>

        <div className="courses-hero-rail">
          <div className="courses-hero-rail-card courses-stat">
            <div className="courses-hero-rail-icon"><i className="fa-solid fa-layer-group"></i></div>
            <div className="courses-hero-rail-copy">
              <strong>Courses</strong>
              <span>Total courses added</span>
            </div>
            <div className="courses-hero-rail-value">{courses.length}</div>
          </div>
          <div className="courses-hero-rail-card aliases-stat">
            <div className="courses-hero-rail-icon"><i className="fa-solid fa-code-branch"></i></div>
            <div className="courses-hero-rail-copy">
              <strong>Aliases</strong>
              <span>Alias groups detected</span>
            </div>
            <div className="courses-hero-rail-value">{totalAliases}</div>
          </div>
          <div className="courses-hero-rail-card missing-stat">
            <div className="courses-hero-rail-icon"><i className="fa-solid fa-circle-exclamation"></i></div>
            <div className="courses-hero-rail-copy">
              <strong>Need Aliases</strong>
              <span>Courses need aliases</span>
            </div>
            <div className="courses-hero-rail-value">{coursesWithoutAliases.length}</div>
          </div>
        </div>
      </section>

      <div className="courses-workspace">
        <section className="course-form-shell glass-panel panel-accent">
          <div className="courses-panel-header">
            <div className="courses-panel-title-wrap">
              <div className="courses-panel-icon">
                <i className="fa-solid fa-plus"></i>
              </div>
              <div>
                <h2 className="courses-panel-title">Add Course</h2>
                <p className="courses-panel-subtitle">Code and full name are required. Aliases are optional but recommended.</p>
              </div>
            </div>
          </div>

          <form className="course-workspace-form" onSubmit={handleCreateCourse}>
            <label className="course-field">
              <span className="course-field-label">Course Code</span>
              <div className="course-field-input-wrap">
                <i className="fa-solid fa-hashtag"></i>
                <input
                  value={newCourse.course_code}
                  onChange={(event) => setNewCourse((current) => ({ ...current, course_code: event.target.value }))}
                  placeholder="e.g. CS301"
                />
              </div>
            </label>

            <label className="course-field">
              <span className="course-field-label">Course Name</span>
              <div className="course-field-input-wrap">
                <i className="fa-solid fa-book-open"></i>
                <input
                  value={newCourse.course_name}
                  onChange={(event) => setNewCourse((current) => ({ ...current, course_name: event.target.value }))}
                  placeholder="e.g. Operating Systems"
                />
              </div>
            </label>

            <label className="course-field">
              <span className="course-field-label">Short Name</span>
              <div className="course-field-input-wrap">
                <i className="fa-solid fa-signature"></i>
                <input
                  value={newCourse.short_name}
                  onChange={(event) => setNewCourse((current) => ({ ...current, short_name: event.target.value }))}
                  placeholder="e.g. OS"
                />
              </div>
            </label>

            <label className="course-field course-field-wide">
              <span className="course-field-label">Aliases</span>
              <div className="course-alias-box">
                <div className="course-alias-box-head">
                  <i className="fa-solid fa-tags"></i>
                  <span>Add aliases separated by commas</span>
                </div>
                <textarea
                  value={newCourse.aliases}
                  onChange={(event) => setNewCourse((current) => ({ ...current, aliases: event.target.value }))}
                  placeholder="e.g. OS, Ops Sys, Operating System"
                  rows={4}
                />
                {textToAliases(newCourse.aliases).length > 0 && (
                  <div className="course-alias-preview">
                    {textToAliases(newCourse.aliases).map((alias) => (
                      <span key={alias} className="course-alias-pill">{alias}</span>
                    ))}
                  </div>
                )}
              </div>
            </label>

            <div className="course-form-footer">
              <button className="btn btn-primary course-save-btn" type="submit" disabled={savingId === 'new-course'}>
                {savingId === 'new-course'
                  ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</>
                  : <><i className="fa-solid fa-floppy-disk"></i> Save Course</>}
              </button>
              <div className={`course-form-feedback ${error ? 'error' : status ? 'success' : ''}`}>
                {error || status || 'Build a clean subject library for accurate academic mapping.'}
              </div>
            </div>
          </form>
        </section>

        <section className="course-library-shell glass-panel panel-accent">
          <div className="courses-panel-header">
            <div className="courses-panel-title-wrap">
              <div className="courses-panel-icon alt">
                <i className="fa-solid fa-book-open-reader"></i>
              </div>
              <div>
                <h2 className="courses-panel-title">Saved Courses</h2>
                <p className="courses-panel-subtitle">{courses.length} courses available for matching.</p>
              </div>
            </div>
            <button className="btn btn-outline course-refresh-btn" type="button" onClick={loadCourses} disabled={loading}>
              <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
              Refresh
            </button>
          </div>

          <div className="course-library-list">
            {loading ? (
              <div className="course-empty-state loading">
                <div className="course-empty-visual">
                  <div className="course-empty-book"><i className="fa-solid fa-circle-notch fa-spin"></i></div>
                </div>
                <div className="course-empty-copy">
                  <h3>Loading courses</h3>
                </div>
              </div>
            ) : courses.length === 0 ? (
              <div className="course-empty-state">
                <div className="course-empty-particle particle-a"></div>
                <div className="course-empty-particle particle-b"></div>
                <div className="course-empty-visual">
                  <div className="course-empty-book">
                    <i className="fa-solid fa-book-open"></i>
                  </div>
                </div>
                <div className="course-empty-copy">
                  <h3>No courses saved yet</h3>
                  <p>Your saved academic subjects will appear here.</p>
                </div>
                <div className="course-empty-highlights">
                  <span><i className="fa-solid fa-code-branch"></i> Start building your course library</span>
                  <span><i className="fa-solid fa-robot"></i> AI will help map incoming messages automatically</span>
                  <span><i className="fa-solid fa-check"></i> Keep everything clean and organized</span>
                </div>
              </div>
            ) : courses.map((course) => (
              <article key={course.id} className="course-vault-card">
                <div className="course-vault-top">
                  <div className="course-vault-main">
                    <div className="course-code-mark">{course.course_code}</div>
                    <div className="course-vault-copy">
                      <h3>{course.course_name}</h3>
                      <p>{course.short_name ? `Short name: ${course.short_name}` : 'Short name not added yet'}</p>
                    </div>
                  </div>
                  <div className="course-vault-meta">
                    <span className="course-vault-chip">{course.aliases?.length || 0} aliases</span>
                    <span className="course-vault-chip neutral">Manual setup</span>
                  </div>
                </div>

                <div className="course-vault-tags">
                  {course.aliases?.length > 0 ? (
                    course.aliases.map((alias) => <span key={alias} className="course-alias-pill">{alias}</span>)
                  ) : (
                    <span className="course-vault-placeholder">No aliases saved yet</span>
                  )}
                </div>

                <div className="course-alias-editor">
                  <div className="course-alias-editor-input">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    <input
                      value={aliasDrafts[course.id] || ''}
                      onChange={(event) => setAliasDrafts((current) => ({ ...current, [course.id]: event.target.value }))}
                      placeholder="Aliases separated by commas"
                    />
                  </div>
                  <button className="btn btn-outline course-alias-save-btn" type="button" onClick={() => handleSaveAliases(course)} disabled={savingId === course.id}>
                    {savingId === course.id ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                    Save
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
