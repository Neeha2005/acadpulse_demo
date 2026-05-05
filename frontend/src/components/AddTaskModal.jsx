import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';

const DEADLINE_REQUIRED = new Set(['assignment', 'quiz', 'exam_schedule']);

export default function AddTaskModal({ onClose }) {
  const { createManualTask, apiFetch, authUser } = useAppContext();
  const [courses, setCourses] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    course: '',
    dueDate: '',
    dueTime: '',
    content: '',
    type: 'assignment',
  });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    apiFetch('/courses', {}, false)
      .then(payload => setCourses(Array.isArray(payload?.courses) ? payload.courses : []))
      .catch(() => {});
  }, [apiFetch]);

  const needsDeadline = DEADLINE_REQUIRED.has(formData.type);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (needsDeadline && (!formData.dueDate || !formData.dueTime)) {
      setErrorMsg('Date and time are required for this type.');
      return;
    }

    if (formData.dueDate && formData.dueTime) {
      const selectedDateTime = new Date(`${formData.dueDate}T${formData.dueTime}`);
      if (selectedDateTime < new Date()) {
        setErrorMsg('Deadline cannot be in the past.');
        return;
      }
    }

    setErrorMsg('');
    setStatus('saving');

    try {
      await createManualTask({
        ...formData,
        user_id: authUser?.id,
      });
      setStatus('idle');
      onClose();
    } catch (error) {
      setStatus('idle');
      setErrorMsg(error.message || 'Unable to create task right now.');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="panel-title">
            <i className="fa-solid fa-plus text-primary"></i> Add Notification
          </h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                Type
              </label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} style={inputStyle}>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="announcement">Announcement</option>
                <option value="material">Material</option>
                <option value="event">Event</option>
                <option value="exam_schedule">Exam Schedule</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                Title <span className="text-urgent">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="e.g. OS Assignment #3 — process scheduler"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                Course
              </label>
              {courses.length > 0 ? (
                <select value={formData.course} onChange={e => setFormData({ ...formData, course: e.target.value })} style={inputStyle}>
                  <option value="">No course selected</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.course_code || c.course_name}>
                      {c.course_code} — {c.course_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.course}
                  onChange={e => setFormData({ ...formData, course: e.target.value })}
                  placeholder="e.g. CS301 or Operating Systems"
                  style={inputStyle}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                  Due Date {needsDeadline && <span className="text-urgent">*</span>}
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  required={needsDeadline}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                  Time {needsDeadline && <span className="text-urgent">*</span>}
                </label>
                <input
                  type="time"
                  value={formData.dueTime}
                  onChange={e => setFormData({ ...formData, dueTime: e.target.value })}
                  required={needsDeadline}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                Description
              </label>
              <textarea
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                rows={3}
                placeholder="Additional details, instructions, or notes..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--urgent)', fontSize: 13, padding: '10px 12px', background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={status === 'saving' || !formData.title.trim()}>
              {status === 'saving'
                ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</>
                : <><i className="fa-solid fa-plus"></i> Add</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
