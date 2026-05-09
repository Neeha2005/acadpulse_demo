import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BookOpen,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  ExternalLink,
  GraduationCap,
  Hash,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  School,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import '../onboarding.css'

const TOTAL_STEPS = 8
const SEMESTERS = Array.from({ length: 8 }, (_, i) => `${i + 1}${['st', 'nd', 'rd'][i] || 'th'} Semester`)
const DAYS = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [7, 'Sunday'],
]
const STORAGE_KEY = 'acadpulse_onboarding_draft_v2'

const DEFAULT_DATA = {
  profile: {
    university: localStorage.getItem('acadpulse_university') || '',
    degree: localStorage.getItem('acadpulse_degree') || '',
    semester: localStorage.getItem('acadpulse_semester') || '',
    section: localStorage.getItem('acadpulse_section') || '',
  },
  platforms: { whatsapp: false, gmail: false, classroom: false },
  preferences: {
    desktopPopups: true,
    morningDigest: true,
    digestTime: '08:00',
    criticalAlerts: true,
    whatsappReminders: false,
  },
  whatsappGroups: [],
  mappings: {
    whatsapp: [],
    gmail: [],
    classroom: [],
  },
  courses: [
    { id: 'course-1', course_code: '', course_name: '', short_name: '' },
  ],
  timetable: [],
}

function readDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      ...DEFAULT_DATA,
      ...parsed,
      profile: { ...DEFAULT_DATA.profile, ...(parsed.profile || {}) },
      platforms: { ...DEFAULT_DATA.platforms, ...(parsed.platforms || {}) },
      preferences: { ...DEFAULT_DATA.preferences, ...(parsed.preferences || {}) },
      whatsappGroups: Array.isArray(parsed.whatsappGroups) ? parsed.whatsappGroups : DEFAULT_DATA.whatsappGroups,
      mappings: { ...DEFAULT_DATA.mappings, ...(parsed.mappings || {}) },
      courses: Array.isArray(parsed.courses) && parsed.courses.length ? parsed.courses : DEFAULT_DATA.courses,
      timetable: Array.isArray(parsed.timetable) ? parsed.timetable : DEFAULT_DATA.timetable,
    }
  } catch {
    return DEFAULT_DATA
  }
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast.message) return undefined
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [toast.message, onDismiss])

  if (!toast.message) return null
  return (
    <div className={`onb-toast ${toast.type}`} role="status" aria-live="polite">
      {toast.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
      <span>{toast.message}</span>
    </div>
  )
}

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      className={`onb-toggle ${checked ? 'is-on' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-label={label}
      aria-pressed={checked}
    >
      <span />
    </button>
  )
}

function StepBadge({ children }) {
  return <div className="onb-badge">{children}</div>
}

function Field({ label, optional, icon, error, children }) {
  return (
    <label className={`onb-field ${error ? 'has-error' : ''}`}>
      <span className="onb-label">
        {label}
        {optional && <em>(Optional)</em>}
      </span>
      <div className="onb-input-wrap">
        {icon}
        {children}
      </div>
      {error && (
        <small className="onb-error">
          <AlertCircle size={13} />
          {error}
        </small>
      )}
    </label>
  )
}

function SemesterDropdown({ value, onChange, error }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="onb-dropdown" ref={ref}>
      <button
        type="button"
        className={`onb-select ${!value ? 'is-placeholder' : ''} ${error ? 'has-error' : ''}`}
        onClick={() => setOpen((current) => !current)}
      >
        <Hash size={17} />
        <span>{value || 'Select your semester'}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="onb-options" role="listbox">
          {SEMESTERS.map((semester) => (
            <button
              key={semester}
              type="button"
              className={value === semester ? 'selected' : ''}
              onClick={() => {
                onChange(semester)
                setOpen(false)
              }}
            >
              {semester}
              {value === semester && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WelcomeStep({ name }) {
  return (
    <section className="onb-step onb-welcome">
      <div className="onb-ambient onb-ambient-purple" />
      <div className="onb-ambient onb-ambient-cyan" />
      <div className="onb-logo-mark">
        <GraduationCap size={36} />
      </div>
      <div className="onb-wordmark">AcadPulse</div>
      <h1>
        Welcome, <span>{name}</span>!
      </h1>
      <p>Let's set up your academic command center.</p>
      <div className="onb-feature-list">
        {[
          ['signal', 'Connects WhatsApp, Gmail & Classroom'],
          ['brain', 'Understands Roman Urdu automatically'],
          ['bolt', 'Never miss a deadline again'],
        ].map(([kind, text], index) => (
          <div className="onb-feature" style={{ '--delay': `${index * 120}ms` }} key={text}>
            <div className={`onb-feature-icon ${kind}`}>{kind === 'signal' ? <Sparkles size={18} /> : kind === 'brain' ? <School size={18} /> : <Zap size={18} />}</div>
            <span>{text}</span>
          </div>
        ))}
      </div>
      <div className="onb-time-pill">Takes about 2 minutes</div>
    </section>
  )
}

function ProfileStep({ data, setData, errors, clearError }) {
  const profile = data.profile
  const update = (key, value) => {
    setData((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))
    clearError(key)
  }

  return (
    <section className="onb-step">
      <StepBadge>Your Profile</StepBadge>
      <div className="onb-heading">
        <h1>Tell us about your studies</h1>
        <p>We use this to personalize your experience.</p>
      </div>
      <div className="onb-form">
        <Field label="University Name" icon={<Building2 size={17} />} error={errors.university}>
          <input value={profile.university} onChange={(e) => update('university', e.target.value)} placeholder="e.g. FAST, LUMS, COMSATS, NUST" />
        </Field>
        <Field label="Degree Program" icon={<GraduationCap size={17} />} error={errors.degree}>
          <input value={profile.degree} onChange={(e) => update('degree', e.target.value)} placeholder="e.g. BS Computer Science" />
        </Field>
        <label className={`onb-field ${errors.semester ? 'has-error' : ''}`}>
          <span className="onb-label">Current Semester</span>
          <SemesterDropdown value={profile.semester} onChange={(value) => update('semester', value)} error={errors.semester} />
          {errors.semester && (
            <small className="onb-error">
              <AlertCircle size={13} />
              {errors.semester}
            </small>
          )}
        </label>
        <Field label="Section / Class Group" optional icon={<Users size={17} />}>
          <input value={profile.section} onChange={(e) => update('section', e.target.value)} placeholder="e.g. BCS-6A, BSCS-F22" />
        </Field>
      </div>
    </section>
  )
}

function PlatformCard({ platform, checked, onToggle }) {
  const details = {
    whatsapp: {
      icon: <MessageCircle size={26} />,
      name: 'WhatsApp Groups',
      description: 'Monitor your class WhatsApp groups for assignments, quizzes and announcements',
      status: checked ? "You'll scan QR in the next step" : 'Not selected',
    },
    gmail: {
      icon: <Mail size={26} />,
      name: 'Gmail',
      description: 'Fetch academic emails from your university Gmail inbox',
      status: checked ? 'Google sign-in appears in the next step' : 'Not selected',
    },
    classroom: {
      icon: <School size={26} />,
      name: 'Google Classroom',
      description: 'Sync assignments, coursework and announcements from your courses',
      status: checked ? 'Google sign-in appears in the next step' : 'Not selected',
    },
  }[platform]

  return (
    <div className={`onb-platform-card ${platform} ${checked ? 'selected' : ''}`}>
      {checked && <div className="onb-check-badge"><Check size={13} /></div>}
      <div className={`onb-platform-icon ${platform}`}>{details.icon}</div>
      <div className="onb-platform-copy">
        <strong>{details.name}</strong>
        <p>{details.description}</p>
      </div>
      <Toggle checked={checked} onChange={onToggle} label={`Toggle ${details.name}`} />
      <div className="onb-platform-status">
        <span className={checked ? 'live' : ''} />
        <span>{details.status}</span>
      </div>
    </div>
  )
}

function PlatformsStep({ data, setData, platformError }) {
  const update = (platform, value) => {
    setData((current) => ({ ...current, platforms: { ...current.platforms, [platform]: value } }))
  }

  return (
    <section className="onb-step">
      <StepBadge>Integrations</StepBadge>
      <div className="onb-heading">
        <h1>Connect your platforms</h1>
        <p>Select the tools you want AcadPulse to monitor. You can change these later.</p>
      </div>
      {platformError && <div className="onb-banner danger">{platformError}</div>}
      <div className={`onb-platforms ${platformError ? 'shake' : ''}`}>
        {['whatsapp', 'gmail', 'classroom'].map((platform) => (
          <PlatformCard
            key={platform}
            platform={platform}
            checked={data.platforms[platform]}
            onToggle={(value) => update(platform, value)}
          />
        ))}
      </div>
    </section>
  )
}

function SetupStep({
  data,
  connection,
  qr,
  qrMessage,
  qrLoading,
  setupUnlocked,
  refreshQr,
  onOAuth,
  detectedGroups,
  selectedDetectedGroupIds,
  toggleDetectedGroup,
  saveDetectedGroups,
  groupSelectionSaving,
  groupSelectionPending,
}) {
  const selected = data.platforms
  const needsNothing = (!selected.whatsapp || connection.whatsapp)
    && (!selected.gmail || connection.gmail)
    && (!selected.classroom || connection.classroom)
    && !groupSelectionPending

  return (
    <section className="onb-step">
      <StepBadge>Setup</StepBadge>
      <div className="onb-heading">
        <h1>Let's connect everything</h1>
        <p>Complete setup for your selected platforms.</p>
      </div>
      {needsNothing && <div className="onb-banner success">Everything is already connected! Moving on...</div>}
      <div className="onb-setup-stack">
        {selected.whatsapp && (
          <div className="onb-setup-section">
            <h3><MessageCircle size={18} /> Scan WhatsApp QR Code</h3>
            {connection.whatsapp ? (
              <div className="onb-connected-pill">WhatsApp already connected</div>
            ) : (
              <>
                <p>Open WhatsApp on your phone, tap Linked Devices, then scan this code.</p>
                <div className="onb-qr-box">
                  {qrLoading && <div className="onb-shimmer" />}
                  {!qrLoading && qr && <img src={qr} alt="WhatsApp QR code" />}
                  {!qrLoading && !qr && <span>{qrMessage || 'QR not available yet'}</span>}
                </div>
                <div className="onb-waiting"><Loader2 size={15} /> Waiting for scan...</div>
                <button className="onb-ghost-btn" type="button" onClick={refreshQr}><RefreshCw size={14} /> Refresh QR</button>
              </>
            )}
          </div>
        )}
        {selected.gmail && (
          <div className="onb-setup-section">
            <h3><Mail size={18} /> Connect Gmail</h3>
            {connection.gmail ? (
              <div className="onb-connected-pill">Connected as: {connection.gmailEmail || 'Google account'}</div>
            ) : (
              <button className="onb-google-btn" type="button" onClick={() => onOAuth('gmail')}>
                <span>G</span>
                Continue with Google for Gmail
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        )}
        {selected.classroom && (
          <div className="onb-setup-section">
            <h3><School size={18} /> Google Classroom</h3>
            {connection.classroom ? (
              <>
                <div className="onb-connected-pill">Google Classroom authorized</div>
                <div className="onb-course-pills">
                  {connection.classroomCourses.length ? connection.classroomCourses.slice(0, 8).map((course) => (
                    <span key={course.id || course.classroom_id || course.name}>{course.name || course.classroom_name || course.id}</span>
                  )) : <em>No active courses found - you can add them manually later.</em>}
                </div>
              </>
            ) : (
              <button className="onb-google-btn" type="button" onClick={() => onOAuth('classroom')}>
                <span>G</span>
                Continue with Google for Classroom
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      {setupUnlocked && <div className="onb-banner">You can continue now and finish connections later.</div>}
    </section>
  )
}

function getCourseLabel(course) {
  return [course.course_code, course.course_name].filter(Boolean).join(' - ') || course.short_name || ''
}

function WhatsAppGroupsStep({ data, setData, detectedGroups, selectedDetectedGroupIds, toggleDetectedGroup, saveDetectedGroups, groupSelectionSaving, connection }) {
  const savedGroups = data.whatsappGroups || []
  const courseGroups = savedGroups.filter((group) => group.kind !== 'society')
  const societyGroups = savedGroups.filter((group) => group.kind === 'society')

  const updateGroup = (groupId, key, value) => {
    setData((current) => ({
      ...current,
      whatsappGroups: (current.whatsappGroups || []).map((group) => (
        group.group_id === groupId ? { ...group, [key]: value } : group
      )),
    }))
  }

  return (
    <section className="onb-step">
      <StepBadge>WhatsApp Groups</StepBadge>
      <div className="onb-heading">
        <h1>Choose the groups to monitor</h1>
        <p>Select only the WhatsApp groups AcadPulse should watch, then split them into subject groups and society groups.</p>
      </div>
      {!data.platforms.whatsapp && <div className="onb-banner">WhatsApp was not selected. Continue to subject mapping.</div>}
      {data.platforms.whatsapp && !connection.whatsapp && <div className="onb-banner danger">Connect WhatsApp in the previous step first.</div>}
      {data.platforms.whatsapp && connection.whatsapp && (
        <div className="onb-setup-stack">
          <div className="onb-setup-section">
            <h3><MessageCircle size={18} /> Group selection</h3>
            {detectedGroups.length ? (
              <>
                <div className="onb-group-picker">
                  <div className="onb-group-picker-head">
                    <strong>Select WhatsApp groups to monitor</strong>
                    <span>{selectedDetectedGroupIds.size} selected</span>
                  </div>
                  <div className="onb-group-picker-list">
                    {detectedGroups.map((group) => (
                      <label className="onb-group-check" key={group.group_id}>
                        <input
                          type="checkbox"
                          checked={selectedDetectedGroupIds.has(group.group_id)}
                          onChange={() => toggleDetectedGroup(group.group_id)}
                        />
                        <span>
                          <strong>{group.group_name || group.group_id}</strong>
                          <em>{group.group_id}</em>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="onb-primary-btn"
                    type="button"
                    onClick={saveDetectedGroups}
                    disabled={groupSelectionSaving}
                  >
                    {groupSelectionSaving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                    Save selected groups
                  </button>
                </div>
                {savedGroups.length > 0 && (
                  <div className="onb-map-section">
                    <h3><Users size={16} /> Subject vs society</h3>
                    <div className="onb-map-list">
                      {savedGroups.map((group) => (
                        <div className="onb-map-row" key={group.group_id}>
                          <input
                            value={group.group_name || ''}
                            onChange={(e) => updateGroup(group.group_id, 'group_name', e.target.value)}
                            placeholder="Group name"
                          />
                          <span>-&gt;</span>
                          <select value={group.kind || 'course'} onChange={(e) => updateGroup(group.group_id, 'kind', e.target.value)}>
                            <option value="course">Subject / Course group</option>
                            <option value="society">Society / Community group</option>
                          </select>
                          <small style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{group.group_id}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="onb-waiting"><Loader2 size={15} /> Loading WhatsApp groups...</div>
            )}
          </div>
          {savedGroups.length > 0 && (
            <div className="onb-setup-section">
              <h3><School size={18} /> Current split</h3>
              <div className="onb-course-pills">
                {courseGroups.length ? courseGroups.map((group) => (
                  <span key={`course-${group.group_id}`}>{group.group_name || group.group_id}</span>
                )) : <em>No course groups selected yet.</em>}
              </div>
              <div className="onb-course-pills" style={{ marginTop: 12 }}>
                {societyGroups.length ? societyGroups.map((group) => (
                  <span key={`society-${group.group_id}`}>{group.group_name || group.group_id}</span>
                )) : <em>No society groups marked yet.</em>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MappingRows({ rows, onChange, leftPlaceholder, coursePlaceholder, courseOptions = [] }) {
  return (
    <div className="onb-map-list">
      {rows.map((row) => (
        <div className="onb-map-row" key={row.id}>
          <input
            value={row.sourceLabel || row.source}
            onChange={(e) => onChange(row.id, row.sourceLabel ? 'sourceLabel' : 'source', e.target.value)}
            placeholder={leftPlaceholder}
          />
          <span>-&gt;</span>
          {courseOptions.length ? (
            <select value={row.course} onChange={(e) => onChange(row.id, 'course', e.target.value)} aria-label={coursePlaceholder}>
              <option value="">{coursePlaceholder}</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>{getCourseLabel(course)}</option>
              ))}
            </select>
          ) : (
            <input value={row.course} onChange={(e) => onChange(row.id, 'course', e.target.value)} placeholder={coursePlaceholder} />
          )}
          <button type="button" onClick={() => onChange(row.id, 'remove')} aria-label="Remove mapping"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

function SubjectsStep({ data, setData }) {
  const rows = data.courses || []
  const updateCourse = (id, key, value) => {
    setData((current) => ({
      ...current,
      courses: (current.courses || []).map((course) => (
        course.id === id ? { ...course, [key]: value } : course
      )),
    }))
  }
  const removeCourse = (id) => {
    setData((current) => ({
      ...current,
      courses: (current.courses || []).filter((course) => course.id !== id),
      timetable: (current.timetable || []).filter((slot) => slot.course_id !== id),
    }))
  }
  const addCourse = () => {
    setData((current) => ({
      ...current,
      courses: [
        ...(current.courses || []),
        { id: `course-${Date.now()}`, course_code: '', course_name: '', short_name: '' },
      ],
    }))
  }

  return (
    <section className="onb-step">
      <StepBadge>Courses</StepBadge>
      <div className="onb-heading">
        <h1>Create your subject list</h1>
        <p>These are the subjects your selected WhatsApp groups and Classroom courses will map into.</p>
      </div>
      <div className="onb-explain">Add each subject once. Mapping happens in the panel beside it.</div>
      <div className="onb-course-editor">
        {rows.map((course) => (
          <div className="onb-course-row" key={course.id}>
            <div className="onb-mini-field code">
              <span>Code</span>
              <input value={course.course_code || ''} onChange={(e) => updateCourse(course.id, 'course_code', e.target.value)} placeholder="CS301" />
            </div>
            <div className="onb-mini-field">
              <span>Course name</span>
              <input value={course.course_name || ''} onChange={(e) => updateCourse(course.id, 'course_name', e.target.value)} placeholder="Data Structures" />
            </div>
            <div className="onb-mini-field short">
              <span>Short name</span>
              <input value={course.short_name || ''} onChange={(e) => updateCourse(course.id, 'short_name', e.target.value)} placeholder="DSA" />
            </div>
            <button type="button" onClick={() => removeCourse(course.id)} aria-label="Remove course"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="onb-ghost-btn" onClick={addCourse}><Plus size={14} /> Add Course</button>
    </section>
  )
}

function TimetableStep({ data, setData }) {
  const savedCourses = (data.courses || []).filter((course) => course.id && course.course_code && course.course_name)
  const rows = data.timetable || []
  const updateSlot = (id, key, value) => {
    setData((current) => ({
      ...current,
      timetable: (current.timetable || []).map((slot) => (
        slot.id === id ? { ...slot, [key]: value } : slot
      )),
    }))
  }
  const removeSlot = (id) => {
    setData((current) => ({
      ...current,
      timetable: (current.timetable || []).filter((slot) => slot.id !== id),
    }))
  }
  const addSlot = () => {
    setData((current) => ({
      ...current,
      timetable: [
        ...(current.timetable || []),
        {
          id: `slot-${Date.now()}`,
          course_id: savedCourses[0]?.id || '',
          day_of_week: 1,
          start_time: '09:00',
          end_time: '10:00',
          room_number: '',
        },
      ],
    }))
  }

  return (
    <section className="onb-step">
      <StepBadge>Timetable</StepBadge>
      <div className="onb-heading">
        <h1>Build your class schedule</h1>
        <p>AcadPulse uses this to understand what matters today.</p>
      </div>
      {!savedCourses.length && <div className="onb-banner danger">Add at least one course first, then timetable slots can be attached to it.</div>}
      <div className="onb-timetable-list">
        {rows.map((slot) => (
          <div className="onb-slot-row" key={slot.id}>
            <label>
              <BookOpen size={14} />
              <select value={slot.course_id || ''} onChange={(e) => updateSlot(slot.id, 'course_id', e.target.value)}>
                <option value="">Select course</option>
                {savedCourses.map((course) => (
                  <option key={course.id} value={course.id}>{course.course_code} - {course.course_name}</option>
                ))}
              </select>
            </label>
            <label>
              <Calendar size={14} />
              <select value={slot.day_of_week || 1} onChange={(e) => updateSlot(slot.id, 'day_of_week', Number(e.target.value))}>
                {DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <Clock size={14} />
              <input type="time" value={slot.start_time || '09:00'} onChange={(e) => updateSlot(slot.id, 'start_time', e.target.value)} />
            </label>
            <label>
              <Clock size={14} />
              <input type="time" value={slot.end_time || '10:00'} onChange={(e) => updateSlot(slot.id, 'end_time', e.target.value)} />
            </label>
            <label>
              <MapPin size={14} />
              <input value={slot.room_number || ''} onChange={(e) => updateSlot(slot.id, 'room_number', e.target.value)} placeholder="Room" />
            </label>
            <button type="button" onClick={() => removeSlot(slot.id)} aria-label="Remove timetable slot"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="onb-ghost-btn" onClick={addSlot} disabled={!savedCourses.length}><Plus size={14} /> Add Timetable Slot</button>
    </section>
  )
}

function MappingStep({ data, setData, connection, groups }) {
  const courseOptions = (data.courses || []).filter((course) => course.id && course.course_code?.trim() && course.course_name?.trim())
  const updateRows = (type, id, key, value) => {
    setData((current) => {
      const currentRows = current.mappings[type] || []
      const rows = key === 'remove'
        ? currentRows.filter((row) => row.id !== id)
        : currentRows.map((row) => (row.id === id ? { ...row, [key]: value } : row))
      return { ...current, mappings: { ...current.mappings, [type]: rows } }
    })
  }
  const classroomRows = (connection.classroomCourses || []).map((course, index) => {
    const source = String(course.classroom_id || course.id || '')
    const existing = (data.mappings.classroom || []).find((row) => row.source === source)
    return existing || {
      id: `classroom-${index}-${source}`,
      source,
      sourceLabel: course.classroom_name || course.name || source,
      course: '',
    }
  })

  return (
    <section className="onb-step">
      <StepBadge>Course Mapping</StepBadge>
      <div className="onb-heading">
        <h1>Map groups and classrooms to subjects</h1>
        <p>Link each selected WhatsApp group and Classroom course to the right subject name.</p>
      </div>
      <div className="onb-explain">Only course groups appear here. Society and community groups stay out of subject mapping.</div>
      {!courseOptions.length && <div className="onb-banner danger">Add at least one course above before saving mappings.</div>}
      {data.platforms.whatsapp && (
        <div className="onb-map-section">
          <h3><MessageCircle size={16} /> WhatsApp Groups</h3>
          {groups.length ? (
            <MappingRows
              rows={(data.mappings.whatsapp.length ? data.mappings.whatsapp : groups.map((group, index) => ({ id: `wa-${index}`, source: group.group_id, course: '', sourceLabel: group.group_name || group.group_id })))}
              onChange={(id, key, value) => updateRows('whatsapp', id, key, value)}
              leftPlaceholder="WhatsApp group"
              coursePlaceholder="Select course"
              courseOptions={courseOptions}
            />
          ) : <p className="onb-muted">No WhatsApp groups detected yet - you can map them from the dashboard once messages arrive.</p>}
        </div>
      )}
      {connection.classroom && data.platforms.classroom && (
        <div className="onb-map-section">
          <h3><School size={16} /> Classroom Courses</h3>
          {classroomRows.length ? (
            <MappingRows
              rows={classroomRows}
              onChange={(id, key, value) => updateRows('classroom', id, key, value)}
              leftPlaceholder="Classroom course"
              coursePlaceholder="Select course"
              courseOptions={courseOptions}
            />
          ) : <p className="onb-muted">No active Classroom courses found yet.</p>}
        </div>
      )}
    </section>
  )
}

function SubjectsAndMappingStep({ data, setData, connection, groups }) {
  return (
    <div className="onb-combined-step">
      <div className="onb-combined-panel">
        <SubjectsStep data={data} setData={setData} />
      </div>
      <div className="onb-combined-panel">
        <MappingStep data={data} setData={setData} connection={connection} groups={groups} />
      </div>
    </div>
  )
}

function DoneStep({ name, data, connection, mappedCount }) {
  const courseCount = (data.courses || []).filter((course) => course.course_code && course.course_name).length
  const timetableCount = (data.timetable || []).filter((slot) => slot.course_id && slot.start_time && slot.end_time).length
  const summary = [
    `Profile saved - ${data.profile.university || 'University'}, ${data.profile.degree || 'Degree'}, ${data.profile.semester || 'Semester'}`,
    `${courseCount} courses saved`,
    `${timetableCount} timetable slots saved`,
    connection.whatsapp ? 'WhatsApp connected' : 'WhatsApp skipped',
    data.platforms.gmail && connection.gmail ? `Gmail connected${connection.gmailEmail ? ` as ${connection.gmailEmail}` : ''}` : 'Gmail skipped',
    data.platforms.classroom && connection.classroom ? 'Classroom connected' : 'Classroom skipped',
    `${mappedCount} courses mapped`,
    'Notifications configured',
  ]

  return (
    <section className="onb-step onb-done">
      <div className="onb-confetti" aria-hidden="true">
        {Array.from({ length: 30 }, (_, index) => <span key={index} style={{ '--i': index }} />)}
      </div>
      <svg className="onb-done-check" viewBox="0 0 90 90" aria-hidden="true">
        <defs><linearGradient id="onbCheckGrad" x1="0" x2="1"><stop stopColor="#7c3aed" /><stop offset="1" stopColor="#06b6d4" /></linearGradient></defs>
        <circle cx="45" cy="45" r="36" />
        <path d="M27 47l12 13 25-30" />
      </svg>
      <div className="onb-heading">
        <h1>You're all set, <span>{name}</span>!</h1>
        <p>AcadPulse is ready to manage your academic life.</p>
      </div>
      <div className="onb-summary">
        {summary.map((item, index) => (
          <div key={item} style={{ '--delay': `${index * 150}ms` }}>
            {item.includes('skipped') ? <span className="onb-circle">○</span> : <Check size={15} />}
            <span>{item}</span>
          </div>
        ))}
      </div>
      <small>You can update any of these settings anytime from the dashboard.</small>
    </section>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const { API_BASE_URL, apiFetch, user, authUser } = useAppContext()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState('forward')
  const [data, setData] = useState(readDraft)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [resume, setResume] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [platformError, setPlatformError] = useState('')
  const [setupUnlocked, setSetupUnlocked] = useState(false)
  const [groups, setGroups] = useState([])
  const [detectedGroups, setDetectedGroups] = useState([])
  const [detectedGroupsLoaded, setDetectedGroupsLoaded] = useState(false)
  const [selectedDetectedGroupIds, setSelectedDetectedGroupIds] = useState(() => new Set())
  const [groupSelectionSaving, setGroupSelectionSaving] = useState(false)
  const [qr, setQr] = useState('')
  const [qrMessage, setQrMessage] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  const [connection, setConnection] = useState({
    whatsapp: false,
    google: false,
    gmail: localStorage.getItem('acadpulse_gmail_connected') === 'true',
    classroom: localStorage.getItem('acadpulse_classroom_connected') === 'true',
    gmailEmail: '',
    classroomCourses: [],
  })

  const userId = authUser?.id || user?.id || localStorage.getItem('acadpulse_user_id') || ''
  const displayName = (localStorage.getItem('acadpulse_user') || user?.fullName || 'Scholar').split(' ')[0]
  const selectedCount = Object.values(data.platforms).filter(Boolean).length
  const progress = Math.round((step / TOTAL_STEPS) * 100)
  const mappedCount = [
    ...(data.mappings.whatsapp || []),
    ...(data.mappings.classroom || []),
  ].filter((row) => row.source?.trim() && row.course?.trim()).length
  const whatsappGroupSelectionPending = data.platforms.whatsapp
    && connection.whatsapp
    && (!detectedGroupsLoaded || (
      detectedGroups.length > 0 && !detectedGroups.some((group) => group.is_selected)
    ))

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), [])
  const clearError = useCallback((key) => setErrors((current) => ({ ...current, [key]: '' })), [])
  const syncSelectedGroupsToData = useCallback((items) => {
    const normalized = (items || []).map((item) => ({
      group_id: item.group_id || item.group_name || item.name || '',
      group_name: item.group_name || item.group_id || item.name || '',
      kind: item.is_general ? 'society' : 'course',
    })).filter((item) => item.group_id)

    setGroups(normalized)
    setData((current) => {
      const existingGroups = current.whatsappGroups || []
      const nextGroups = normalized.map((group) => {
        const existing = existingGroups.find((item) => item.group_id === group.group_id)
        return existing ? { ...group, kind: existing.kind || group.kind } : group
      })
      const courseOnly = nextGroups.filter((group) => group.kind !== 'society')
      return {
        ...current,
        whatsappGroups: nextGroups,
        mappings: {
          ...current.mappings,
          whatsapp: courseOnly.map((group, index) => {
            const existing = current.mappings.whatsapp?.find((row) => row.source === group.group_id)
            return existing || { id: `wa-${index}-${group.group_id}`, source: group.group_id, course: '' }
          }),
        },
      }
    })
    return normalized
  }, [])

  const getOAuthUrl = useCallback((integration) => {
    const params = new URLSearchParams({ next_path: 'onboarding' })
    if (userId) params.set('user_id', userId)
    if (integration) params.set('integration', integration)
    params.set('frontend_origin', window.location.origin)
    return `${API_BASE_URL}/auth/google?${params.toString()}`
  }, [API_BASE_URL, userId])

  const onboardingData = useMemo(() => ({
    ...data,
    connections: connection,
    selectedGroups: (data.whatsappGroups || []).filter((group) => group.kind !== 'society'),
    societyGroups: (data.whatsappGroups || []).filter((group) => group.kind === 'society'),
  }), [connection, data])

  const saveIntegrationSettings = useCallback(async (platforms) => {
    try {
      await apiFetch('/onboarding/integrations', {
        method: 'POST',
        body: JSON.stringify({
          ...(userId ? { user_id: userId } : {}),
          platforms,
        }),
      }, false)
    } catch {
      showToast('Integration settings save failed - continuing locally', 'error')
    }
  }, [apiFetch, showToast, userId])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!resume) return undefined
    const timer = setTimeout(() => setResume(false), 4000)
    return () => clearTimeout(timer)
  }, [resume])

  useEffect(() => {
    if (!Array.isArray(data.whatsappGroups)) return
    setGroups(data.whatsappGroups)
  }, [data.whatsappGroups])

  const fetchQr = useCallback(async (silent = false) => {
    const quiet = silent === true
    if (!quiet) setQrLoading(true)
    try {
      const payload = await apiFetch(`/whatsapp/qr${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false)
      const raw = payload?.qr || payload?.qr_code || ''
      if (payload?.qr_image || payload?.qr_url) {
        setQr(payload.qr_image || payload.qr_url)
        setQrMessage('')
      } else if (raw) {
        setQr(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(raw)}`)
        setQrMessage('')
      } else {
        setQr('')
        setQrMessage(payload?.message || 'QR not available yet')
      }
    } catch {
      setQr('')
      setQrMessage('WhatsApp QR is not available yet')
      if (!quiet) showToast('WhatsApp QR is not available yet', 'error')
    } finally {
      if (!quiet) setQrLoading(false)
    }
  }, [apiFetch, showToast])

  const fetchConnectionState = useCallback(async (syncClassroom = false) => {
    try {
      const classroomParams = new URLSearchParams()
      if (userId) classroomParams.set('user_id', userId)
      if (syncClassroom) classroomParams.set('sync', 'true')
      const classroomPath = `/classroom/courses${classroomParams.toString() ? `?${classroomParams.toString()}` : ''}`
      const whatsappPath = `/whatsapp/status${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`
      const [google, whatsapp, classroom] = await Promise.allSettled([
        apiFetch('/google/status'),
        apiFetch(whatsappPath, {}, false),
        apiFetch(classroomPath, {}, false),
      ])
      setConnection((current) => ({
        ...current,
        google: google.status === 'fulfilled' ? Boolean(google.value?.connected) : current.google,
        gmailEmail: google.status === 'fulfilled' ? (google.value?.email || current.gmailEmail) : current.gmailEmail,
        whatsapp: whatsapp.status === 'fulfilled' ? whatsapp.value?.whatsapp?.status === 'connected' : current.whatsapp,
        gmail: current.gmail || localStorage.getItem('acadpulse_gmail_connected') === 'true',
        classroom: current.classroom || localStorage.getItem('acadpulse_classroom_connected') === 'true',
        classroomCourses: classroom.status === 'fulfilled' && Array.isArray(classroom.value?.courses) ? classroom.value.courses : current.classroomCourses,
      }))
    } catch {
      showToast('Could not refresh connection status', 'error')
    }
  }, [apiFetch, showToast, userId])

  const refreshSelectedGroups = useCallback(async () => {
    const payload = await apiFetch(`/whatsapp/groups${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false)
    return syncSelectedGroupsToData(payload?.groups || [])
  }, [apiFetch, syncSelectedGroupsToData, userId])

  const loadDetectedGroups = useCallback(async () => {
    if (!userId) return
    try {
      const payload = await apiFetch(`/whatsapp/groups/detected?user_id=${encodeURIComponent(userId)}`, {}, false)
      const nextDetected = Array.isArray(payload?.groups) ? payload.groups : []
      setDetectedGroups(nextDetected)
      setSelectedDetectedGroupIds(new Set(nextDetected.filter((group) => group.is_selected).map((group) => group.group_id)))
    } catch {
      setDetectedGroups([])
    } finally {
      setDetectedGroupsLoaded(true)
    }
  }, [apiFetch, userId])

  const toggleDetectedGroup = useCallback((groupId) => {
    setSelectedDetectedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const saveDetectedGroups = useCallback(async () => {
    if (!userId) return
    setGroupSelectionSaving(true)
    try {
      const payload = await apiFetch('/whatsapp/groups/selection', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          group_ids: Array.from(selectedDetectedGroupIds),
        }),
      }, false)
      syncSelectedGroupsToData(payload?.groups || [])
      await loadDetectedGroups()
      showToast('WhatsApp group selection saved')
    } catch {
      showToast('WhatsApp group selection could not be saved', 'error')
    } finally {
      setGroupSelectionSaving(false)
    }
  }, [apiFetch, loadDetectedGroups, selectedDetectedGroupIds, showToast, syncSelectedGroupsToData, userId])

  useEffect(() => {
    if (!connection.whatsapp) return
    loadDetectedGroups()
    refreshSelectedGroups().catch(() => {})
  }, [connection.whatsapp, loadDetectedGroups, refreshSelectedGroups])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [status, groupsPayload, coursesPayload, timetablePayload] = await Promise.allSettled([
          apiFetch(`/onboarding/status${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false),
          apiFetch(`/whatsapp/groups${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false),
          apiFetch(`/courses${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false),
          apiFetch('/timetable'),
        ])
        if (!mounted) return
        if (groupsPayload.status === 'fulfilled') {
          syncSelectedGroupsToData(groupsPayload.value?.groups || [])
        }
        if (coursesPayload.status === 'fulfilled' && Array.isArray(coursesPayload.value?.courses) && coursesPayload.value.courses.length) {
          setData((current) => ({
            ...current,
            courses: coursesPayload.value.courses.map((course) => ({
              id: String(course.id || course.course_id || course.course_code),
              course_code: course.course_code || '',
              course_name: course.course_name || '',
              short_name: course.short_name || '',
            })),
          }))
        }
        if (timetablePayload.status === 'fulfilled' && Array.isArray(timetablePayload.value?.slots)) {
          setData((current) => ({
            ...current,
            timetable: timetablePayload.value.slots.map((slot) => ({
              id: String(slot.id || `slot-${Date.now()}`),
              course_id: String(slot.course_id || ''),
              day_of_week: Number(slot.day_of_week || 1),
              start_time: slot.start_time || '09:00',
              end_time: slot.end_time || '10:00',
              room_number: slot.room_number || '',
            })),
          }))
        }
        if (status.status === 'fulfilled' && !status.value?.completed) {
          const nextStep = Math.min(Math.max(Number(status.value?.current_step || 1), 1), TOTAL_STEPS)
          if (nextStep > 1) {
            setStep(nextStep)
            setResume(true)
          }
          if (status.value?.data) {
            setData((current) => ({
              ...current,
              ...status.value.data,
              profile: { ...current.profile, ...(status.value.data.profile || {}) },
              platforms: { ...current.platforms, ...(status.value.data.platforms || {}) },
              preferences: { ...current.preferences, ...(status.value.data.preferences || {}) },
              whatsappGroups: Array.isArray(status.value.data.whatsappGroups) && status.value.data.whatsappGroups.length ? status.value.data.whatsappGroups : current.whatsappGroups,
              mappings: { ...current.mappings, ...(status.value.data.mappings || {}) },
              courses: Array.isArray(status.value.data.courses) && status.value.data.courses.length ? status.value.data.courses : current.courses,
              timetable: Array.isArray(status.value.data.timetable) ? status.value.data.timetable : current.timetable,
            }))
          }
        }
      } catch {
        showToast('Starting onboarding fresh', 'error')
      }
    }
    load()
    fetchConnectionState()
    return () => { mounted = false }
  }, [apiFetch, fetchConnectionState, showToast, syncSelectedGroupsToData, userId])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('google_connected') !== '1') return undefined

    const storedEmail = localStorage.getItem('acadpulse_user_email') || user?.email || authUser?.email || ''
    const integration = params.get('google_integration')
    if (integration === 'gmail') localStorage.setItem('acadpulse_gmail_connected', 'true')
    if (integration === 'classroom') localStorage.setItem('acadpulse_classroom_connected', 'true')
    const nextPlatforms = {
      ...data.platforms,
      ...(integration === 'gmail' ? { gmail: true } : {}),
      ...(integration === 'classroom' ? { classroom: true } : {}),
    }
    setData((current) => ({
      ...current,
      platforms: {
        ...current.platforms,
        ...(integration === 'gmail' ? { gmail: true } : {}),
        ...(integration === 'classroom' ? { classroom: true } : {}),
      },
    }))
    setConnection((current) => ({
      ...current,
      google: true,
      gmail: current.gmail || integration === 'gmail',
      classroom: current.classroom || integration === 'classroom',
      gmailEmail: current.gmailEmail || storedEmail,
    }))
    saveIntegrationSettings(nextPlatforms)
    showToast(`${integration === 'classroom' ? 'Classroom' : 'Gmail'} connected successfully`, 'success')
    fetchConnectionState(integration === 'classroom')
    const retryOne = setTimeout(() => fetchConnectionState(integration === 'classroom'), 1000)
    const retryTwo = setTimeout(() => fetchConnectionState(integration === 'classroom'), 3000)
    window.history.replaceState({}, '', '/onboarding')

    return () => {
      clearTimeout(retryOne)
      clearTimeout(retryTwo)
    }
  }, [authUser?.email, data.platforms, fetchConnectionState, location.search, saveIntegrationSettings, showToast, user?.email])

  useEffect(() => {
    if (step !== 4 || !data.platforms.whatsapp || connection.whatsapp) return undefined
    fetchQr(false)
    fetchConnectionState()
    const statusPoll = setInterval(fetchConnectionState, 3000)
    const qrPoll = setInterval(() => fetchQr(true), 5000)
    return () => {
      clearInterval(statusPoll)
      clearInterval(qrPoll)
    }
  }, [connection.whatsapp, data.platforms.whatsapp, fetchConnectionState, fetchQr, step])

  useEffect(() => {
    if (step !== 4) return undefined
    setSetupUnlocked(false)
    const timer = setTimeout(() => setSetupUnlocked(true), 5000)
    return () => clearTimeout(timer)
  }, [step])

  useEffect(() => {
    if (step !== 4) return undefined
      const allDone = (!data.platforms.whatsapp || connection.whatsapp)
      && (!data.platforms.gmail || connection.gmail)
      && (!data.platforms.classroom || connection.classroom)
    if (!allDone) return undefined
    const timer = setTimeout(() => goNext(), 1500)
    return () => clearTimeout(timer)
    // goNext is intentionally omitted to avoid re-arming auto-advance on save state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.classroom, connection.gmail, connection.whatsapp, data.platforms.classroom, data.platforms.gmail, data.platforms.whatsapp, step, whatsappGroupSelectionPending])

  const saveProgress = useCallback(async (targetStep = step) => {
    try {
      await apiFetch('/onboarding/progress', {
        method: 'POST',
        body: JSON.stringify({
          ...(userId ? { user_id: userId } : {}),
          step: Math.min(targetStep, TOTAL_STEPS),
          data: onboardingData,
        }),
      }, false)
    } catch {
      showToast('Progress save failed - continuing locally', 'error')
    }
  }, [apiFetch, onboardingData, showToast, step, userId])

  const validate = () => {
    if (step === 2) {
      const next = {}
      if (!data.profile.university.trim()) next.university = 'University name is required'
      if (!data.profile.degree.trim()) next.degree = 'Degree program is required'
      if (!data.profile.semester.trim()) next.semester = 'Semester is required'
      setErrors(next)
      return Object.keys(next).length === 0
    }
    if (step === 3 && selectedCount === 0) {
      setPlatformError('Please select at least one platform to continue')
      setTimeout(() => setPlatformError(''), 2200)
      return false
    }
    if (step === 6) {
      const partial = (data.courses || []).find((course) => {
        const code = course.course_code?.trim()
        const name = course.course_name?.trim()
        return (code && !name) || (!code && name)
      })
      if (partial) {
        showToast('Course code and course name are both required', 'error')
        return false
      }
    }
    if (step === 7) {
      const invalid = (data.timetable || []).find((slot) => (
        !slot.course_id || !slot.day_of_week || !slot.start_time || !slot.end_time
      ))
      if (invalid) {
        showToast('Complete each timetable row or remove it', 'error')
        return false
      }
    }
    return true
  }

  const persistProfileLocally = () => {
    localStorage.setItem('acadpulse_university', data.profile.university)
    localStorage.setItem('acadpulse_degree', data.profile.degree)
    localStorage.setItem('acadpulse_semester', data.profile.semester)
    localStorage.setItem('acadpulse_section', data.profile.section)
  }

  const saveMappings = async (coursesOverride = data.courses) => {
    const savedCourses = (coursesOverride || []).filter((course) => course.id && course.course_code?.trim() && course.course_name?.trim())
    const courseIdByLabel = new Map(savedCourses.flatMap((course) => ([
      [course.id, course.id],
      [course.course_code, course.id],
      [course.course_name, course.id],
      [getCourseLabel(course), course.id],
    ])))
    const rows = [
      ...(data.mappings.whatsapp || []).map((row) => ({ ...row, type: 'whatsapp' })),
      ...(data.mappings.classroom || []).map((row) => ({ ...row, type: 'classroom' })),
    ]
      .map((row) => ({ ...row, course_id: courseIdByLabel.get(row.course) || row.course }))
      .filter((row) => row.source?.trim() && row.course_id?.trim())
    if (!rows.length) return
    const failures = []
    try {
      const payload = await apiFetch('/courses/map', {
        method: 'POST',
        body: JSON.stringify({
          ...(userId ? { user_id: userId } : {}),
          mappings: rows.map((row) => ({
            source_type: row.type,
            source_reference_id: row.source,
            course_id: row.course_id,
          })),
        }),
      }, false)
      if (payload?.skipped_count) showToast(`${payload.skipped_count} mapping could not be saved`, 'error')
    } catch {
      failures.push(...rows)
      showToast(`${failures.length} mapping could not be saved`, 'error')
    }
  }

  const saveCourses = async () => {
    const rows = (data.courses || []).filter((course) => course.course_code?.trim() && course.course_name?.trim())
    if (!rows.length) return []
    const saved = []
    for (const course of rows) {
      try {
        const payload = await apiFetch('/courses', {
          method: 'POST',
          body: JSON.stringify({
            ...(userId ? { user_id: userId } : {}),
            course_code: course.course_code.trim(),
            course_name: course.course_name.trim(),
            short_name: course.short_name?.trim() || undefined,
          }),
        }, false)
        const next = payload?.course
        saved.push({
          ...course,
          id: String(next?.id || next?.course_id || course.id),
          course_code: next?.course_code || course.course_code.trim(),
          course_name: next?.course_name || course.course_name.trim(),
          short_name: next?.short_name || course.short_name || '',
        })
      } catch {
        showToast(`Could not save ${course.course_code}`, 'error')
        saved.push(course)
      }
    }
    setData((current) => ({
      ...current,
      courses: saved,
      timetable: (current.timetable || []).map((slot) => {
        const match = rows.find((course) => course.id === slot.course_id)
        const next = match ? saved.find((course) => course.course_code === match.course_code) : null
        return next ? { ...slot, course_id: next.id } : slot
      }),
    }))
    return saved
  }

  const saveTimetable = async () => {
    const rows = (data.timetable || []).filter((slot) => slot.course_id && slot.start_time && slot.end_time)
    if (!rows.length) return
    for (const slot of rows) {
      if (!String(slot.id || '').startsWith('slot-')) continue
      try {
        await apiFetch('/timetable', {
          method: 'POST',
          body: JSON.stringify({
            course_id: slot.course_id,
            day_of_week: Number(slot.day_of_week),
            start_time: slot.start_time,
            end_time: slot.end_time,
            room_number: slot.room_number?.trim() || undefined,
          }),
        })
      } catch {
        showToast('One timetable slot could not be saved', 'error')
      }
    }
  }

  const goNext = useCallback(async () => {
    if (saving || !validate()) return
    setSaving(true)
    try {
      if (step === 2) persistProfileLocally()
      if (step === 6) {
        const savedCourses = await saveCourses()
        await saveMappings(savedCourses.length ? savedCourses : data.courses)
      }
      if (step === 7) await saveTimetable()
      const next = Math.min(step + 1, TOTAL_STEPS)
      await saveProgress(next)
      setDirection('forward')
      setStep(next)
    } finally {
      setSaving(false)
    }
  }, [saveProgress, saving, step])

  const goBack = () => {
    setDirection('back')
    setStep((current) => Math.max(1, current - 1))
  }

  const skip = async () => {
    const next = Math.min(step + 1, TOTAL_STEPS)
    await saveProgress(next)
    setDirection('forward')
    setStep(next)
  }

  const finish = async () => {
    setFinishing(true)
    localStorage.setItem('acadpulse_onboarding_complete', 'true')
    try {
      persistProfileLocally()
      const savedCourses = await saveCourses()
      await saveMappings(savedCourses.length ? savedCourses : data.courses)
      await saveTimetable()
      await apiFetch('/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({ ...(userId ? { user_id: userId } : {}), data: onboardingData }),
      }, false)
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      showToast('Could not save final state, opening dashboard anyway', 'error')
    } finally {
      navigate('/dashboard', { replace: true })
    }
  }

  const continueLabel = {
    1: "Let's Get Started ->",
    2: 'Continue ->',
    3: 'Continue ->',
    4: 'All Done ->',
    5: data.platforms.whatsapp ? 'Continue to Mapping ->' : 'Skip WhatsApp Groups ->',
    6: (data.courses || []).some((course) => course.course_code?.trim() && course.course_name?.trim()) ? 'Save Subjects & Mapping ->' : 'Skip Mapping ->',
    7: (data.timetable || []).length ? 'Save Timetable ->' : 'Skip Timetable ->',
  }[step]

  const disableContinue = saving
    || (step === 2 && (!data.profile.university || !data.profile.degree || !data.profile.semester))
    || (step === 4 && !setupUnlocked && (
      (data.platforms.gmail && !connection.gmail)
      || (data.platforms.classroom && !connection.classroom)
    ))

  return (
    <main className="onb-screen">
      <div className="onb-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="onb-top">
        {step > 1 ? (
          <button type="button" className="onb-back" onClick={goBack}><ChevronLeft size={16} /> Back</button>
        ) : <span />}
        <div className="onb-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => {
            const dotStep = index + 1
            return <span key={dotStep} className={`${dotStep < step ? 'done' : ''} ${dotStep === step ? 'active' : ''}`} />
          })}
        </div>
        {[3, 5, 6, 7].includes(step) ? <button type="button" className="onb-skip" onClick={skip}>{'Skip this step ->'}</button> : <span />}
      </div>
      {resume && <div className="onb-resume">Welcome back {displayName} - picking up where you left off.</div>}
      <div className={`onb-content ${direction} ${step === 6 ? 'wide' : ''}`} key={step}>
        {step === 1 && <WelcomeStep name={displayName} />}
        {step === 2 && <ProfileStep data={data} setData={setData} errors={errors} clearError={clearError} />}
        {step === 3 && <PlatformsStep data={data} setData={setData} platformError={platformError} />}
        {step === 4 && (
          <SetupStep
            data={data}
            connection={connection}
            qr={qr}
            qrMessage={qrMessage}
            qrLoading={qrLoading}
            setupUnlocked={setupUnlocked}
            refreshQr={() => fetchQr(false)}
            onOAuth={(integration) => window.location.assign(getOAuthUrl(integration))}
            detectedGroups={detectedGroups}
            selectedDetectedGroupIds={selectedDetectedGroupIds}
            toggleDetectedGroup={toggleDetectedGroup}
            saveDetectedGroups={saveDetectedGroups}
            groupSelectionSaving={groupSelectionSaving}
            groupSelectionPending={whatsappGroupSelectionPending}
          />
        )}
        {step === 5 && (
          <WhatsAppGroupsStep
            data={data}
            setData={setData}
            connection={connection}
            detectedGroups={detectedGroups}
            selectedDetectedGroupIds={selectedDetectedGroupIds}
            toggleDetectedGroup={toggleDetectedGroup}
            saveDetectedGroups={saveDetectedGroups}
            groupSelectionSaving={groupSelectionSaving}
          />
        )}
        {step === 6 && <SubjectsAndMappingStep data={data} setData={setData} connection={connection} groups={groups.filter((group) => group.kind !== 'society')} />}
        {step === 7 && <TimetableStep data={data} setData={setData} />}
        {step === 8 && <DoneStep name={displayName} data={data} connection={connection} mappedCount={mappedCount} />}
        {step < TOTAL_STEPS && (
          <button className="onb-primary" type="button" onClick={goNext} disabled={disableContinue}>
            {saving ? <Loader2 size={18} className="spin" /> : continueLabel}
          </button>
        )}
        {step === TOTAL_STEPS && (
          <div className="onb-final-actions">
            <button className="onb-primary large" type="button" onClick={finish} disabled={finishing}>
              {finishing ? <Loader2 size={18} className="spin" /> : 'Continue to Dashboard'}
            </button>
          </div>
        )}
      </div>
      <Toast toast={toast} onDismiss={() => setToast({ message: '', type: 'success' })} />
    </main>
  )
}