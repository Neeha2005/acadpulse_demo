import { useCallback, useEffect, useMemo, useState } from 'react'

const SLOT_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4',
  '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#3b82f6',
]

const CLASS_DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
]

const EMPTY_FORM = { course_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:30', room_number: '' }

function fmt12(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function ClassScheduleSection({ apiFetch, userId, title = 'Class Schedule', marginTop = 24 }) {
  const [slots, setSlots] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [slotsRes, coursesRes] = await Promise.all([
        apiFetch('/timetable', {}, false),
        apiFetch(`/courses${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false),
      ])
      setSlots(Array.isArray(slotsRes?.slots) ? slotsRes.slots : [])
      setCourses(Array.isArray(coursesRes?.courses) ? coursesRes.courses : [])
    } catch (err) {
      setError(err.message || 'Failed to load class schedule.')
    } finally {
      setLoading(false)
    }
  }, [apiFetch, userId])

  useEffect(() => {
    load()
  }, [load])

  const colorMap = useMemo(() => {
    const map = {}
    slots.forEach((slot, index) => {
      if (slot.course_id) map[slot.course_id] = SLOT_COLORS[index % SLOT_COLORS.length]
    })
    return map
  }, [slots])

  const slotsByDow = useMemo(() => {
    const map = {}
    CLASS_DAYS.forEach(({ dow }) => {
      map[dow] = []
    })
    slots.forEach((slot) => {
      if (map[slot.day_of_week]) map[slot.day_of_week].push(slot)
    })
    return map
  }, [slots])

  const activeCourseCount = useMemo(
    () => new Set(slots.map((slot) => slot.course_id).filter(Boolean)).size,
    [slots],
  )

  const handleEdit = (slot) => {
    setEditId(slot.id)
    setForm({
      course_id: slot.course_id || '',
      day_of_week: slot.day_of_week,
      start_time: slot.start_time || '08:00',
      end_time: slot.end_time || '09:30',
      room_number: slot.room_number || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (slotId) => {
    setDeleting(slotId)
    setError('')
    try {
      const res = await apiFetch(`/timetable/${slotId}`, { method: 'DELETE' }, false)
      setSlots(Array.isArray(res?.slots) ? res.slots : slots.filter((slot) => slot.id !== slotId))
    } catch (err) {
      setError(err.message || 'Failed to delete slot.')
    } finally {
      setDeleting(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.course_id || !form.start_time || !form.end_time) {
      setError('Course, start time, and end time are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        course_id: form.course_id,
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        room_number: form.room_number || null,
      }
      const res = editId
        ? await apiFetch(`/timetable/${editId}`, { method: 'PUT', body: JSON.stringify(body) }, false)
        : await apiFetch('/timetable', { method: 'POST', body: JSON.stringify(body) }, false)
      setSlots(Array.isArray(res?.slots) ? res.slots : [])
      setForm(EMPTY_FORM)
      setEditId(null)
      setShowForm(false)
    } catch (err) {
      setError(err.message || 'Failed to save slot.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(false)
    setError('')
  }

  return (
    <div className="panel glass-panel panel-accent class-schedule-panel" style={{ marginTop }}>
      <div className="panel-header class-schedule-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div>
          <h2 className="panel-title"><i className="fa-solid fa-chalkboard-user text-primary"></i> {title}</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Your weekly class timetable from Monday to Friday
          </p>
        </div>
        <div className="class-schedule-toolbar">
          <button className="btn btn-outline" onClick={load} disabled={loading} title="Refresh">
            <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
          </button>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true) }}>
              <i className="fa-solid fa-plus"></i> Add Slot
            </button>
          )}
        </div>
      </div>

      <div className="class-schedule-body">
        {error && (
          <div className="class-schedule-alert error">
            <i className="fa-solid fa-triangle-exclamation"></i> {error}
          </div>
        )}

        {!loading && (
          <div className="class-schedule-summary">
            <div className="class-schedule-chip">
              <span className="class-schedule-chip-label">Weekly Slots</span>
              <strong>{slots.length}</strong>
            </div>
            <div className="class-schedule-chip">
              <span className="class-schedule-chip-label">Active Courses</span>
              <strong>{activeCourseCount}</strong>
            </div>
            <div className="class-schedule-chip">
              <span className="class-schedule-chip-label">Open Days</span>
              <strong>{CLASS_DAYS.filter(({ dow }) => slotsByDow[dow].length > 0).length}</strong>
            </div>
          </div>
        )}

        {loading ? (
          <div className="timetable-loading">
            <i className="fa-solid fa-circle-notch fa-spin"></i> Loading class schedule...
          </div>
        ) : (
          <div className="class-week-grid">
            {CLASS_DAYS.map(({ dow, label }) => (
              <div key={dow} className="class-day-column">
                <div className="class-day-title">
                  {label}
                </div>
                <div className="class-day-slots">
                  {slotsByDow[dow].length === 0 ? (
                    <div className="class-day-empty">No classes</div>
                  ) : slotsByDow[dow].map((slot) => {
                    const color = colorMap[slot.course_id] || 'var(--primary)'
                    return (
                      <div key={slot.id} className="class-slot-card" style={{ '--slot-color': color }}>
                        <div className="class-slot-time">
                          {fmt12(slot.start_time)} - {fmt12(slot.end_time)}
                        </div>
                        <div className="class-slot-code">
                          {slot.course_code || slot.course_name || '-'}
                        </div>
                        {slot.course_name && slot.course_code && (
                          <div className="class-slot-meta">{slot.course_name}</div>
                        )}
                        {slot.room_number && (
                          <div className="class-slot-room">
                            <i className="fa-solid fa-location-dot" style={{ marginRight: 4 }}></i>{slot.room_number}
                          </div>
                        )}
                        <div className="class-slot-actions">
                          <button type="button" title="Edit" className="class-slot-action class-slot-edit" onClick={() => handleEdit(slot)}>
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button type="button" title="Delete" className="class-slot-action class-slot-delete" onClick={() => handleDelete(slot.id)} disabled={deleting === slot.id}>
                            {deleting === slot.id ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-trash-can"></i>}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="class-slot-form">
            <strong className="class-slot-form-title">{editId ? 'Edit Class Slot' : 'Add New Class Slot'}</strong>
            <div className="class-slot-form-grid">
              <div>
                <label className="class-slot-field-label">Course *</label>
                <select className="class-slot-field" value={form.course_id} onChange={(e) => setForm((current) => ({ ...current, course_id: e.target.value }))} required>
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.course_code} - {course.course_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="class-slot-field-label">Day *</label>
                <select className="class-slot-field" value={form.day_of_week} onChange={(e) => setForm((current) => ({ ...current, day_of_week: Number(e.target.value) }))}>
                  {CLASS_DAYS.map(({ dow, label }) => <option key={dow} value={dow}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="class-slot-field-label">Start Time *</label>
                <input className="class-slot-field" type="time" value={form.start_time} onChange={(e) => setForm((current) => ({ ...current, start_time: e.target.value }))} required />
              </div>
              <div>
                <label className="class-slot-field-label">End Time *</label>
                <input className="class-slot-field" type="time" value={form.end_time} onChange={(e) => setForm((current) => ({ ...current, end_time: e.target.value }))} required />
              </div>
              <div className="class-slot-field-span">
                <label className="class-slot-field-label">Room / Location</label>
                <input className="class-slot-field" type="text" value={form.room_number} onChange={(e) => setForm((current) => ({ ...current, room_number: e.target.value }))} placeholder="e.g. Room 301, Online, Lab-A" />
              </div>
            </div>
            <div className="class-slot-form-actions">
              <button type="button" className="btn btn-outline" onClick={handleCancel}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : editId ? 'Save Changes' : 'Add Slot'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
