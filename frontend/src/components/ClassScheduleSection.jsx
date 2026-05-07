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
    <div className="panel glass-panel panel-accent" style={{ marginTop }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div>
          <h2 className="panel-title"><i className="fa-solid fa-chalkboard-user text-primary"></i> {title}</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Your weekly class timetable from Monday to Friday
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
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

      <div style={{ padding: 24 }}>
        {error && (
          <div style={{ color: 'var(--urgent)', background: 'var(--urgent-subtle)', border: '1px solid var(--urgent)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <i className="fa-solid fa-triangle-exclamation"></i> {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 32 }}>
            <i className="fa-solid fa-circle-notch fa-spin"></i> Loading class schedule...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, overflowX: 'auto' }}>
            {CLASS_DAYS.map(({ dow, label }) => (
              <div key={dow} style={{ minHeight: 180 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, textAlign: 'center' }}>
                  {label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {slotsByDow[dow].length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 20 }}>No classes</div>
                  ) : slotsByDow[dow].map((slot) => {
                    const color = colorMap[slot.course_id] || 'var(--primary)'
                    return (
                      <div key={slot.id} style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)', borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '10px 12px', position: 'relative' }}>
                        <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 3 }}>
                          {fmt12(slot.start_time)} - {fmt12(slot.end_time)}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {slot.course_code || '-'}
                        </div>
                        {slot.room_number && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            <i className="fa-solid fa-location-dot" style={{ marginRight: 4 }}></i>{slot.room_number}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button type="button" title="Edit" onClick={() => handleEdit(slot)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', fontSize: 12 }}>
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          <button type="button" title="Delete" onClick={() => handleDelete(slot.id)} disabled={deleting === slot.id} style={{ background: 'none', border: 'none', color: 'var(--urgent)', cursor: 'pointer', padding: '2px 4px', fontSize: 12 }}>
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
          <form onSubmit={handleSubmit} style={{ marginTop: 24, padding: 20, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <strong style={{ fontSize: 14 }}>{editId ? 'Edit Class Slot' : 'Add New Class Slot'}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Course *</label>
                <select value={form.course_id} onChange={(e) => setForm((current) => ({ ...current, course_id: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} required>
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.course_code} - {course.course_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Day *</label>
                <select value={form.day_of_week} onChange={(e) => setForm((current) => ({ ...current, day_of_week: Number(e.target.value) }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
                  {CLASS_DAYS.map(({ dow, label }) => <option key={dow} value={dow}>{label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Start Time *</label>
                <input type="time" value={form.start_time} onChange={(e) => setForm((current) => ({ ...current, start_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>End Time *</label>
                <input type="time" value={form.end_time} onChange={(e) => setForm((current) => ({ ...current, end_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Room / Location</label>
                <input type="text" value={form.room_number} onChange={(e) => setForm((current) => ({ ...current, room_number: e.target.value }))} placeholder="e.g. Room 301, Online, Lab-A" style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
