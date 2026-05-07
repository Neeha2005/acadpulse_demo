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
      <section className="hero-stats glass-banner courses-hero">
        <div className="welcome-text">
          <span className="hero-kicker">COURSES</span>
          <h1 className="hero-title">Course Library</h1>
          <p>Keep course codes, names, and short forms clean so incoming messages map correctly.</p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Courses</span>
            <strong>{courses.length}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Aliases</span>
            <strong>{totalAliases}</strong>
          </div>
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Need Aliases</span>
            <strong>{coursesWithoutAliases.length}</strong>
          </div>
        </div>
      </section>

      {(error || status) && (
        <div className={`course-alert ${error ? 'error' : 'success'}`}>
          <i className={`fa-solid ${error ? 'fa-triangle-exclamation' : 'fa-check'}`}></i>
          {error || status}
        </div>
      )}

      <div className="courses-layout">
        <section className="panel glass-panel panel-accent course-form-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title"><i className="fa-solid fa-plus text-primary"></i> Add Course</h2>
              <p>Code and full name are required. Aliases are optional but recommended.</p>
            </div>
          </div>

          <form className="course-form" onSubmit={handleCreateCourse}>
            <label>
              <span>Course Code</span>
              <input
                value={newCourse.course_code}
                onChange={(event) => setNewCourse((current) => ({ ...current, course_code: event.target.value }))}
                placeholder="CS301"
              />
            </label>
            <label>
              <span>Course Name</span>
              <input
                value={newCourse.course_name}
                onChange={(event) => setNewCourse((current) => ({ ...current, course_name: event.target.value }))}
                placeholder="Operating Systems"
              />
            </label>
            <label>
              <span>Short Name</span>
              <input
                value={newCourse.short_name}
                onChange={(event) => setNewCourse((current) => ({ ...current, short_name: event.target.value }))}
                placeholder="OS"
              />
            </label>
            <label>
              <span>Aliases</span>
              <textarea
                value={newCourse.aliases}
                onChange={(event) => setNewCourse((current) => ({ ...current, aliases: event.target.value }))}
                placeholder="OS, Ops Sys, Operating System"
                rows={3}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={savingId === 'new-course'}>
              {savingId === 'new-course'
                ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</>
                : <><i className="fa-solid fa-floppy-disk"></i> Save Course</>}
            </button>
          </form>
        </section>

        <section className="panel glass-panel panel-accent course-list-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title"><i className="fa-solid fa-book-open text-primary"></i> Saved Courses</h2>
              <p>{courses.length} courses available for matching.</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={loadCourses} disabled={loading}>
              <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
              Refresh
            </button>
          </div>

          <div className="course-list">
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
              <article key={course.id} className="course-card">
                <div className="course-card-main">
                  <div className="course-code-mark">{course.course_code}</div>
                  <div className="course-card-copy">
                    <h3>{course.course_name}</h3>
                    <p>{course.short_name ? `Short name: ${course.short_name}` : 'No short name saved'}</p>
                  </div>
                  <span className="course-alias-count">{course.aliases?.length || 0} aliases</span>
                </div>
                <div className="course-alias-editor">
                  <input
                    value={aliasDrafts[course.id] || ''}
                    onChange={(event) => setAliasDrafts((current) => ({ ...current, [course.id]: event.target.value }))}
                    placeholder="Aliases separated by commas"
                  />
                  <button className="btn btn-outline" type="button" onClick={() => handleSaveAliases(course)} disabled={savingId === course.id}>
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
