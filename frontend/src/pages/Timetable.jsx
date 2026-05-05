import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDeadline(task) {
  if (!task.deadline) return null;
  const parsed = new Date(task.deadline);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatTaskTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getTaskBorderColor(task) {
  if (task.urgency === 'urgent') return 'var(--urgent)';
  if (task.source === 'whatsapp') return 'var(--whatsapp)';
  if (task.source === 'classroom') return 'var(--warning)';
  if (task.source === 'gmail') return 'var(--urgent)';
  return 'var(--primary)';
}

function buildMonthCells(anchorDate, scheduledTasks) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const firstVisible = addDays(firstOfMonth, -firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstVisible, index);
    return {
      date,
      isCurrentMonth: date.getMonth() === anchorDate.getMonth(),
      items: scheduledTasks.filter((task) => sameDay(task.deadlineDate, date)),
    };
  });
}

function ScheduleItem({ task, compact = false, onOpen }) {
  const borderColor = getTaskBorderColor(task);

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      title={`${task.title} - ${task.course}\nDue: ${task.due || 'No deadline set'}`}
      style={{
        width: '100%',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 6,
        padding: compact ? '7px 8px' : 12,
        cursor: 'pointer',
        color: 'var(--text)',
        textAlign: 'left',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      <span style={{ fontSize: compact ? 10 : 11, color: borderColor, fontWeight: 700, display: 'block', marginBottom: 4 }}>
        {task.deadlineDate ? formatTaskTime(task.deadlineDate) : 'No time'}
      </span>
      <h4 style={{ fontSize: compact ? 11 : 13, margin: 0, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {task.title}
      </h4>
      <p style={{ fontSize: compact ? 10 : 11, margin: '4px 0 0', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {task.course}
      </p>
    </button>
  );
}

// ─── Class schedule palette — one colour per slot index ──────────────────────
const SLOT_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4',
  '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#3b82f6',
];
// day_of_week: 1=Mon … 5=Fri (only Mon–Fri in the grid)
const CLASS_DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
];
const DOW_LABELS = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
const EMPTY_FORM = { course_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:30', room_number: '' };

function fmt12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function ClassScheduleSection({ apiFetch, authUser }) {
  const [slots, setSlots] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [slotsRes, coursesRes] = await Promise.all([
        apiFetch('/timetable', {}, false),
        apiFetch('/courses', {}, false),
      ]);
      setSlots(Array.isArray(slotsRes?.slots) ? slotsRes.slots : []);
      setCourses(Array.isArray(coursesRes?.courses) ? coursesRes.courses : []);
    } catch (err) {
      setError(err.message || 'Failed to load class schedule.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const colorMap = useMemo(() => {
    const map = {};
    slots.forEach((s, i) => { if (s.course_id) map[s.course_id] = SLOT_COLORS[i % SLOT_COLORS.length]; });
    return map;
  }, [slots]);

  const slotsByDow = useMemo(() => {
    const map = {};
    CLASS_DAYS.forEach(({ dow }) => { map[dow] = []; });
    slots.forEach((s) => { if (map[s.day_of_week]) map[s.day_of_week].push(s); });
    return map;
  }, [slots]);

  const handleEdit = (slot) => {
    setEditId(slot.id);
    setForm({
      course_id: slot.course_id || '',
      day_of_week: slot.day_of_week,
      start_time: slot.start_time || '08:00',
      end_time: slot.end_time || '09:30',
      room_number: slot.room_number || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (slotId) => {
    setDeleting(slotId);
    setError('');
    try {
      const res = await apiFetch(`/timetable/${slotId}`, { method: 'DELETE' }, false);
      setSlots(Array.isArray(res?.slots) ? res.slots : slots.filter((s) => s.id !== slotId));
    } catch (err) {
      setError(err.message || 'Failed to delete slot.');
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.course_id || !form.start_time || !form.end_time) {
      setError('Course, start time, and end time are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        course_id: form.course_id,
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        room_number: form.room_number || null,
      };
      let res;
      if (editId) {
        res = await apiFetch(`/timetable/${editId}`, { method: 'PUT', body: JSON.stringify(body) }, false);
      } else {
        res = await apiFetch('/timetable', { method: 'POST', body: JSON.stringify(body) }, false);
      }
      setSlots(Array.isArray(res?.slots) ? res.slots : []);
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
    } catch (err) {
      setError(err.message || 'Failed to save slot.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
    setError('');
  };

  return (
    <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div>
          <h2 className="panel-title"><i className="fa-solid fa-chalkboard-user text-primary"></i> Class Schedule</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Your weekly class timetable — Mon to Fri
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={load} disabled={loading} title="Refresh">
            <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
          </button>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); }}>
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

        {/* Mon–Fri grid */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 32 }}>
            <i className="fa-solid fa-circle-notch fa-spin"></i> Loading class schedule…
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
                    const color = colorMap[slot.course_id] || 'var(--primary)';
                    return (
                      <div key={slot.id} style={{ background: 'var(--surface-hover)', border: `1px solid var(--border)`, borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '10px 12px', position: 'relative' }}>
                        <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 3 }}>
                          {fmt12(slot.start_time)} – {fmt12(slot.end_time)}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {slot.course_code || '—'}
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
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginTop: 24, padding: 20, background: 'rgba(0,0,0,0.28)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <strong style={{ fontSize: 14 }}>{editId ? 'Edit Class Slot' : 'Add New Class Slot'}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Course *</label>
                <select value={form.course_id} onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} required>
                  <option value="">Select course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.course_code} — {c.course_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Day *</label>
                <select value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
                  {CLASS_DAYS.map(({ dow, label }) => <option key={dow} value={dow}>{label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Start Time *</label>
                <input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>End Time *</label>
                <input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Room / Location</label>
                <input type="text" value={form.room_number} onChange={(e) => setForm((f) => ({ ...f, room_number: e.target.value }))} placeholder="e.g. Room 301, Online, Lab-A" style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={handleCancel}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving…</> : editId ? 'Save Changes' : 'Add Slot'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Suppress unused-variable lint warnings for DOW_LABELS (kept for potential reuse)
void DOW_LABELS;

export default function Timetable() {
  const [view, setView] = useState('week');
  const { tasks, setActiveTaskModal, apiFetch, authUser } = useAppContext();

  const today = startOfDay(new Date());
  const weekStart = addDays(today, -today.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const scheduledTasks = useMemo(
    () => tasks
      .map((task) => ({ ...task, deadlineDate: parseDeadline(task) }))
      .filter((task) => task.deadlineDate)
      .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime()),
    [tasks],
  );

  const unscheduledTasks = useMemo(
    () => tasks.filter((task) => !parseDeadline(task)),
    [tasks],
  );

  const weekMapping = weekDays.map((date) => ({
    date,
    items: scheduledTasks.filter((task) => sameDay(task.deadlineDate, date)),
  }));

  const monthCells = buildMonthCells(today, scheduledTasks);
  const upcomingCount = scheduledTasks.filter((task) => task.deadlineDate >= today).length;
  const urgentCount = scheduledTasks.filter((task) => task.urgency === 'urgent').length;
  const todayCount = scheduledTasks.filter((task) => sameDay(task.deadlineDate, today)).length;

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">TIME BLOCKS</span>
          <h1 className="hero-title">Master Timetable</h1>
          <p>Your dated assignments, quizzes, events, and exam schedules organized by real deadlines.</p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Today</span>
            <strong>{todayCount}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Upcoming</span>
            <strong>{upcomingCount}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Unscheduled</span>
            <strong>{unscheduledTasks.length}</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-pending"><i className="fa-solid fa-calendar-day"></i></div>
            <div className="stat-trend trend-pill trend-pill-pending">dated queue</div>
          </div>
          <div className="stat-value stat-value-pending">{scheduledTasks.length}</div>
          <div className="stat-label">Scheduled Items</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-urgent"><i className="fa-solid fa-fire"></i></div>
            <div className="stat-trend trend-pill trend-pill-urgent">live urgency</div>
          </div>
          <div className="stat-value stat-value-urgent">{urgentCount}</div>
          <div className="stat-label">Urgent Slots</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-messages"><i className="fa-solid fa-calendar-xmark"></i></div>
            <div className="stat-trend trend-pill trend-pill-messages">needs date</div>
          </div>
          <div className="stat-value stat-value-messages">{unscheduledTasks.length}</div>
          <div className="stat-label">Unscheduled Items</div>
        </div>
      </div>

      <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
        <div className="panel-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div>
            <h2 className="panel-title"><i className="fa-regular fa-calendar text-primary"></i> {view === 'week' ? 'This Week' : formatMonthLabel(today)}</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {scheduledTasks.length} dated items from your integration pipeline
            </p>
          </div>
          <div className="filters glass-pill-group">
            <button className={`filter-btn glass-filter-pill ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
            <button className={`filter-btn glass-filter-pill ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
          </div>
        </div>

        <div className="modal-body" style={{ minHeight: 420, padding: view === 'week' ? '24px' : '24px' }}>
          {view === 'week' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              {weekMapping.map((dayBlock) => (
                <div
                  key={dayBlock.date.toISOString()}
                  style={{
                    minHeight: 260,
                    borderTop: dayBlock.items.length > 0 ? '3px solid var(--primary)' : '3px solid var(--border)',
                    background: dayBlock.items.length > 0 ? 'var(--surface-hover)' : 'transparent',
                    borderRadius: '8px 8px 0 0',
                    padding: 12,
                  }}
                >
                  <h3 style={{ fontSize: 13, color: sameDay(dayBlock.date, today) ? 'var(--warning)' : 'var(--text-muted)', textAlign: 'center', margin: '0 0 16px', textTransform: 'uppercase' }}>
                    {formatDayLabel(dayBlock.date)}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dayBlock.items.length > 0 ? (
                      dayBlock.items.map((task) => <ScheduleItem key={task.id} task={task} onOpen={setActiveTaskModal} />)
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', paddingTop: 30 }}>No scheduled items</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(96px, 1fr))', gap: 10, overflowX: 'auto' }}>
              {WEEKDAYS.map((day) => (
                <div key={day} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>{day}</div>
              ))}
              {monthCells.map((block) => {
                const activeDay = sameDay(block.date, today);
                return (
                  <div
                    key={block.date.toISOString()}
                    style={{
                      minHeight: 116,
                      background: block.items.length > 0 ? 'var(--primary-subtle)' : 'var(--surface-hover)',
                      border: activeDay ? '1px solid var(--warning)' : block.items.length > 0 ? '1px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 10,
                      opacity: block.isCurrentMonth ? 1 : 0.45,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <span style={{ fontSize: 13, color: activeDay ? 'var(--warning)' : block.items.length > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>
                      {block.date.getDate()}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      {block.items.slice(0, 3).map((task) => (
                        <ScheduleItem key={task.id} task={task} compact onOpen={setActiveTaskModal} />
                      ))}
                      {block.items.length > 3 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{block.items.length - 3} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {unscheduledTasks.length > 0 && (
        <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
          <div className="panel-header">
            <h2 className="panel-title"><i className="fa-solid fa-calendar-xmark text-warning"></i> Unscheduled Items</h2>
            <span className="badge badge-warning">{unscheduledTasks.length} need dates</span>
          </div>
          <div className="tasks-list" style={{ padding: '8px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {unscheduledTasks.slice(0, 6).map((task) => (
              <ScheduleItem key={task.id} task={task} onOpen={setActiveTaskModal} />
            ))}
          </div>
        </div>
      )}

      <ClassScheduleSection apiFetch={apiFetch} authUser={authUser} />
    </div>
  );
}
