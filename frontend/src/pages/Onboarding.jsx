import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  Mail,
  MessageCircle,
  School,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const TOTAL_STEPS = 5;
const STEP_LABELS = ['University', 'Platforms', 'Sources', 'Timetable', 'Finish'];
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const GROUP_FALLBACKS = ['FAST NLP Group', 'OS Section A', 'DB Lab Updates'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function StatusDot({ connected }) {
  return <span className={`onboarding-status-dot ${connected ? 'connected' : ''}`}></span>;
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      className={`onboarding-switch ${checked ? 'on' : ''}`}
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={label}
      aria-pressed={checked}
    >
      <span></span>
    </button>
  );
}

function PlatformCard({
  type,
  icon,
  title,
  subtitle,
  enabled,
  connected,
  onToggle,
  children,
}) {
  return (
    <div className={`platform-card ${type} ${enabled ? 'enabled' : ''}`}>
      <div className="platform-card-main">
        <div className={`platform-icon ${type}`}>{icon}</div>
        <div className="platform-copy">
          <div className="platform-title-row">
            <h3>{title}</h3>
            <StatusDot connected={connected} />
          </div>
          <p>{subtitle}</p>
        </div>
        <ToggleSwitch checked={enabled} onChange={onToggle} label={`Toggle ${title}`} />
      </div>
      <div className={`platform-card-extra ${enabled ? 'open' : ''}`}>{children}</div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="onboarding-confetti" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, index) => (
        <span key={index} style={{ '--i': index }}></span>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { API_BASE_URL, apiFetch, user, authUser } = useAppContext();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState('forward');
  const [errors, setErrors] = useState({});
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrState, setQrState] = useState({ loading: false, value: '', error: '' });
  const [toast, setToast] = useState('');
  const [resumeBanner, setResumeBanner] = useState(false);
  const [detectedGroups, setDetectedGroups] = useState([]);
  const [classroomCourses, setClassroomCourses] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [societyGroups, setSocietyGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedClassroomCourse, setSelectedClassroomCourse] = useState('');
  const [manualGroup, setManualGroup] = useState('');
  const [courseName, setCourseName] = useState('');
  const [classroomCourseName, setClassroomCourseName] = useState('');
  const [mappings, setMappings] = useState([]);
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [timetableForm, setTimetableForm] = useState({
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    subject: '',
    room: '',
  });
  const [profile, setProfile] = useState({
    university: localStorage.getItem('acadpulse_university') || '',
    degree: localStorage.getItem('acadpulse_degree') || '',
    semester: localStorage.getItem('acadpulse_semester') || '1st',
    section: localStorage.getItem('acadpulse_section') || '',
  });
  const [platforms, setPlatforms] = useState({
    whatsapp: true,
    gmail: true,
    classroom: true,
  });
  const [connections, setConnections] = useState({
    whatsapp: false,
    gmailEmail: user.email || '',
    classroomCourses: 0,
  });

  const studentName = user.fullName || localStorage.getItem('acadpulse_user') || 'Scholar';
  const userId = authUser?.id || user.id || localStorage.getItem('acadpulse_user_id') || '';
  const progress = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  const hasDetectedGroups = detectedGroups.length > 0;
  const hasClassroomCourses = classroomCourses.length > 0;
  const selectedGroupValue = hasDetectedGroups ? selectedGroup : manualGroup;
  const selectedClassroomValue = selectedClassroomCourse;
  const onboardingData = useMemo(() => ({
    profile,
    platforms,
    selectedGroups,
    societyGroups,
    mappings,
    timetable: timetableEntries,
  }), [mappings, platforms, profile, selectedGroups, societyGroups, timetableEntries]);

  const connectedSummary = useMemo(() => {
    const lines = [];
    if (platforms.whatsapp) lines.push(`${connections.whatsapp ? '✓' : '○'} WhatsApp ${connections.whatsapp ? 'connected' : 'selected'}`);
    if (platforms.gmail) lines.push(`${connections.gmailEmail ? '✓' : '○'} Gmail ${connections.gmailEmail ? 'connected' : 'selected'}`);
    if (platforms.classroom) lines.push(`${connections.classroomCourses ? '✓' : '○'} Classroom ${connections.classroomCourses ? `${connections.classroomCourses} courses syncing` : 'selected'}`);
    lines.push(`✓ ${mappings.length} course${mappings.length === 1 ? '' : 's'} mapped`);
    return lines;
  }, [connections, mappings.length, platforms]);

  useEffect(() => {
    let mounted = true;

    const loadSetupData = async () => {
      try {
        const [groupsPayload, statusPayload, classroomPayload, onboardingPayload] = await Promise.allSettled([
          apiFetch('/whatsapp/groups', {}, false),
          apiFetch('/whatsapp/status', {}, false),
          apiFetch('/classroom/courses', {}, false),
          apiFetch(`/onboarding/status${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false),
        ]);

        if (!mounted) return;

        if (groupsPayload.status === 'fulfilled') {
          const groups = Array.isArray(groupsPayload.value?.groups) ? groupsPayload.value.groups : [];
          const normalized = groups
            .map((group) => group.group_name || group.name || group.group_id)
            .filter(Boolean);
          setDetectedGroups(normalized);
          setSelectedGroup(normalized[0] || '');
        } else {
          setDetectedGroups([]);
          setSelectedGroup('');
        }

        if (classroomPayload.status === 'fulfilled') {
          const courses = Array.isArray(classroomPayload.value?.courses) ? classroomPayload.value.courses : [];
          setClassroomCourses(courses);
          setSelectedClassroomCourse(courses[0]?.id || courses[0]?.name || '');
        } else {
          setClassroomCourses([]);
          setSelectedClassroomCourse('');
        }

        setConnections((current) => ({
          ...current,
          whatsapp: statusPayload.status === 'fulfilled' && statusPayload.value?.whatsapp?.status === 'connected',
          classroomCourses:
            classroomPayload.status === 'fulfilled' && Array.isArray(classroomPayload.value?.courses)
              ? classroomPayload.value.courses.length
              : 0,
        }));

        if (
          onboardingPayload.status === 'fulfilled'
          && !onboardingPayload.value?.completed
          && Number(onboardingPayload.value?.current_step) > 0
        ) {
          setResumeBanner(true);
          setDirection('forward');
          setStep(Math.min(Number(onboardingPayload.value.current_step), TOTAL_STEPS));
        }
      } catch {
        if (!mounted) return;
        setDetectedGroups([]);
      }
    };

    loadSetupData();
    return () => {
      mounted = false;
    };
  }, [apiFetch, userId]);

  const goToStep = (nextStep, nextDirection = 'forward') => {
    setDirection(nextDirection);
    setStep(Math.min(TOTAL_STEPS, Math.max(1, nextStep)));
  };

  const validateStep = () => {
    if (step !== 1) return true;

    const nextErrors = {};
    if (!profile.university.trim()) nextErrors.university = 'University name is required';
    if (!profile.degree.trim()) nextErrors.degree = 'Degree program is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  const saveProgress = async (completedStep = step, data = onboardingData) => {
    try {
      await apiFetch('/onboarding/progress', {
        method: 'POST',
        body: JSON.stringify({
          ...(userId ? { user_id: userId } : {}),
          step: completedStep,
          data,
        }),
      }, false);
    } catch {
      showToast('Progress save failed — will retry');
    }
  };

  const next = async () => {
    if (!validateStep()) return;
    if (step === 1) {
      localStorage.setItem('acadpulse_university', profile.university);
      localStorage.setItem('acadpulse_degree', profile.degree);
      localStorage.setItem('acadpulse_semester', profile.semester);
      localStorage.setItem('acadpulse_section', profile.section);
    }
    await saveProgress(step);
    goToStep(step + 1, 'forward');
  };

  const back = () => {
    goToStep(step - 1, 'back');
  };

  const skipAllPlatforms = () => {
    const skippedPlatforms = { whatsapp: false, gmail: false, classroom: false };
    setPlatforms(skippedPlatforms);
    saveProgress(step, { ...onboardingData, platforms: skippedPlatforms });
    goToStep(step + 1, 'forward');
  };

  const openWhatsappQr = async () => {
    setQrModalOpen(true);
    setQrState({ loading: true, value: '', error: '' });

    try {
      const payload = await apiFetch('/whatsapp/qr', {}, false);
      const rawQr = payload?.qr || payload?.qr_code || '';
      const qrImage = payload?.image || payload?.qr_image || payload?.qr_image_url
        || (rawQr ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(rawQr)}` : '');
      setQrState({
        loading: false,
        value: qrImage,
        error: qrImage ? '' : (payload?.message || 'QR code is not available yet.'),
      });
    } catch {
      setQrState({
        loading: false,
        value: '',
        error: 'QR code is not available yet. Make sure the WhatsApp bridge is running.',
      });
    }
  };

  const addMapping = () => {
    const group = selectedGroupValue.trim();
    const course = courseName.trim();

    if (!group || !course || mappings.length >= 5) return;

    setMappings((current) => [...current, {
      id: `${group}-${course}-${current.length}`,
      source_type: 'whatsapp',
      source_reference_id: group,
      group,
      course,
      is_general: societyGroups.includes(group),
    }]);
    setCourseName('');
    if (!hasDetectedGroups) setManualGroup('');
  };

  const addClassroomMapping = () => {
    const classroomId = selectedClassroomValue.trim();
    const course = classroomCourseName.trim();

    if (!classroomId || !course || mappings.length >= 8) return;

    const source = classroomCourses.find((item) => (item.id || item.name) === classroomId);
    setMappings((current) => [...current, {
      id: `classroom-${classroomId}-${course}-${current.length}`,
      source_type: 'classroom',
      source_reference_id: classroomId,
      group: source?.name || classroomId,
      course,
      is_general: false,
    }]);
    setClassroomCourseName('');
  };

  const toggleGroupSelection = (group, setter) => {
    setter((current) => (
      current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group]
    ));
  };

  const addManualMonitorGroup = () => {
    const group = manualGroup.trim();
    if (!group) return;
    setDetectedGroups((current) => (current.includes(group) ? current : [...current, group]));
    setSelectedGroups((current) => (current.includes(group) ? current : [...current, group]));
    setManualGroup('');
    setSelectedGroup(group);
  };

  const addTimetableEntry = () => {
    if (!timetableForm.subject.trim()) return;
    setTimetableEntries((current) => [
      ...current,
      {
        id: `${timetableForm.day}-${timetableForm.startTime}-${current.length}`,
        day: timetableForm.day,
        startTime: timetableForm.startTime,
        endTime: timetableForm.endTime,
        subject: timetableForm.subject.trim(),
        room: timetableForm.room.trim(),
      },
    ]);
    setTimetableForm((current) => ({ ...current, subject: '', room: '' }));
  };

  const finishOnboarding = async () => {
    localStorage.setItem('acadpulse_onboarding_complete', 'true');
    try {
      await apiFetch('/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          ...(userId ? { user_id: userId } : {}),
          data: onboardingData,
        }),
      }, false);
    } catch {
      apiFetch('/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          ...(userId ? { user_id: userId } : {}),
          data: onboardingData,
        }),
      }, false).catch(() => {});
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <main className="onboarding-screen">
      <div className="onboarding-progress-bar">
        <span style={{ width: `${progress}%` }}></span>
      </div>

      <div className="onboarding-topline">
        <button
          className={`onboarding-ghost-btn ${step === 1 ? 'hidden' : ''}`}
          type="button"
          onClick={back}
        >
          Back
        </button>
        <span>Step {step} of {TOTAL_STEPS}</span>
        {step < TOTAL_STEPS ? (
          <button className="onboarding-next-btn" type="button" onClick={next}>
            Continue
          </button>
        ) : (
          <span className="onboarding-top-placeholder"></span>
        )}
      </div>

      {resumeBanner && (
        <div className="onboarding-resume-banner">
          Welcome back! Continue where you left off 👋
        </div>
      )}

      <section className={`onboarding-step-card ${direction === 'forward' ? 'slide-forward' : 'slide-back'}`} key={step}>
        <div className="onboarding-step-rail" aria-label="Onboarding progress">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1;
            return (
              <span
                key={label}
                className={`onboarding-step-pill ${stepNumber === step ? 'active' : ''} ${stepNumber < step ? 'done' : ''}`}
              >
                <i>{stepNumber}</i>
                {label}
              </span>
            );
          })}
        </div>

        {step === 1 && (
          <div className="onboarding-form-step">
            <div className="onboarding-step-heading">
              <h1>Tell us about your university</h1>
              <p>Hi {studentName}. Add your academic info before connecting platforms.</p>
            </div>
            <div className="onboarding-form-grid">
              <label className="onboarding-field">
                <span>University name</span>
                <div className={`onboarding-input-wrap ${errors.university ? 'has-error' : ''}`}>
                  <Building2 size={18} />
                  <input
                    value={profile.university}
                    onChange={(event) => {
                      setProfile((current) => ({ ...current, university: event.target.value }));
                      setErrors((current) => ({ ...current, university: '' }));
                    }}
                    placeholder="FAST, LUMS, COMSATS..."
                  />
                </div>
                {errors.university && <small>{errors.university}</small>}
              </label>

              <label className="onboarding-field">
                <span>Degree program</span>
                <div className={`onboarding-input-wrap ${errors.degree ? 'has-error' : ''}`}>
                  <BookOpen size={18} />
                  <input
                    value={profile.degree}
                    onChange={(event) => {
                      setProfile((current) => ({ ...current, degree: event.target.value }));
                      setErrors((current) => ({ ...current, degree: '' }));
                    }}
                    placeholder="BS Computer Science"
                  />
                </div>
                {errors.degree && <small>{errors.degree}</small>}
              </label>

              <label className="onboarding-field">
                <span>Current semester</span>
                <div className="onboarding-input-wrap onboarding-select-wrap">
                  <BookOpen size={18} />
                  <select
                    value={profile.semester}
                    onChange={(event) => setProfile((current) => ({ ...current, semester: event.target.value }))}
                  >
                    {SEMESTERS.map((semester) => (
                      <option key={semester} value={semester}>{semester}</option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="onboarding-field">
                <span>Section/Group <em>optional</em></span>
                <div className="onboarding-input-wrap">
                  <Users size={18} />
                  <input
                    value={profile.section}
                    onChange={(event) => setProfile((current) => ({ ...current, section: event.target.value }))}
                    placeholder="Section A"
                  />
                </div>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-platform-step">
            <div className="onboarding-step-heading">
              <h1>Connect your academic platforms</h1>
              <p>Choose what you want AcadPulse to monitor</p>
            </div>

            <div className="platform-stack">
              <PlatformCard
                type="whatsapp"
                icon={<MessageCircle size={26} />}
                title="WhatsApp Groups"
                subtitle="Get notified from your class groups"
                enabled={platforms.whatsapp}
                connected={connections.whatsapp}
                onToggle={(value) => setPlatforms((current) => ({ ...current, whatsapp: value }))}
              >
                <button className="platform-action-btn whatsapp" type="button" onClick={openWhatsappQr}>
                  Scan QR code to connect
                </button>
              </PlatformCard>

              <PlatformCard
                type="gmail"
                icon={<Mail size={26} />}
                title="Gmail"
                subtitle="Monitor university emails and deadlines"
                enabled={platforms.gmail}
                connected={Boolean(connections.gmailEmail)}
                onToggle={(value) => setPlatforms((current) => ({ ...current, gmail: value }))}
              >
                {connections.gmailEmail ? (
                  <span className="platform-connected-copy">Connected as: {connections.gmailEmail}</span>
                ) : (
                  <button className="platform-action-btn gmail" type="button" onClick={() => window.location.assign(`${API_BASE_URL}/auth/google${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`)}>
                    Connect Gmail
                  </button>
                )}
              </PlatformCard>

              <PlatformCard
                type="classroom"
                icon={<School size={26} />}
                title="Google Classroom"
                subtitle="Sync coursework, materials, and announcements"
                enabled={platforms.classroom}
                connected={connections.classroomCourses > 0}
                onToggle={(value) => setPlatforms((current) => ({ ...current, classroom: value }))}
              >
                {connections.classroomCourses > 0 ? (
                  <span className="platform-connected-copy">Syncing {connections.classroomCourses} courses</span>
                ) : (
                  <button className="platform-action-btn classroom" type="button" onClick={() => window.location.assign(`${API_BASE_URL}/auth/google${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`)}>
                    Connect Classroom
                  </button>
                )}
              </PlatformCard>
            </div>

            <button className="onboarding-text-link" type="button" onClick={skipAllPlatforms}>
              Skip all for now
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-mapping-step">
            <div className="onboarding-step-heading">
              <h1>Pick groups and map them to courses</h1>
              <p>Select subject groups, mark society groups separately, then link each source to a course.</p>
            </div>

            <div className="mapping-list">
              {detectedGroups.map((group) => (
                <div className="mapping-row" key={group}>
                  <span>{group}</span>
                  <button type="button" className="onboarding-text-link" onClick={() => toggleGroupSelection(group, setSelectedGroups)}>
                    {selectedGroups.includes(group) ? 'Subject selected' : 'Subject group'}
                  </button>
                  <button type="button" className="onboarding-text-link" onClick={() => toggleGroupSelection(group, setSocietyGroups)}>
                    {societyGroups.includes(group) ? 'Society selected' : 'Society group'}
                  </button>
                </div>
              ))}
              {!hasDetectedGroups && (
                <div className="mapping-row">
                  <input value={manualGroup} onChange={(event) => setManualGroup(event.target.value)} placeholder={GROUP_FALLBACKS[0]} />
                  <button type="button" className="onboarding-text-link" onClick={addManualMonitorGroup}>Add group</button>
                </div>
              )}
            </div>

            <div className="mapping-form">
              <label className="onboarding-field">
                <span>WhatsApp group</span>
                <div className="onboarding-input-wrap">
                  <Users size={18} />
                  {hasDetectedGroups ? (
                    <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
                      {detectedGroups.map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={manualGroup}
                      onChange={(event) => setManualGroup(event.target.value)}
                      placeholder={GROUP_FALLBACKS[0]}
                    />
                  )}
                </div>
              </label>

              <label className="onboarding-field">
                <span>Course name</span>
                <div className="onboarding-input-wrap">
                  <BookOpen size={18} />
                  <input
                    value={courseName}
                    onChange={(event) => setCourseName(event.target.value)}
                    placeholder="Natural Language Processing"
                  />
                </div>
              </label>

              <button
                className="onboarding-primary-btn mapping-add-btn"
                type="button"
                onClick={addMapping}
                disabled={!selectedGroupValue.trim() || !courseName.trim() || mappings.length >= 5}
              >
                Add Mapping
              </button>
            </div>

            {hasClassroomCourses && (
              <>
                <div className="onboarding-step-heading">
                  <h1>Map Classroom courses</h1>
                  <p>Select each Google Classroom course and give it the subject name you use in AcadPulse.</p>
                </div>

                <div className="mapping-form">
                  <label className="onboarding-field">
                    <span>Classroom course</span>
                    <div className="onboarding-input-wrap">
                      <School size={18} />
                      <select
                        value={selectedClassroomCourse}
                        onChange={(event) => setSelectedClassroomCourse(event.target.value)}
                      >
                        {classroomCourses.map((course) => {
                          const value = course.id || course.name;
                          return (
                            <option key={value} value={value}>
                              {course.name || course.section || value}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </label>

                  <label className="onboarding-field">
                    <span>Course name</span>
                    <div className="onboarding-input-wrap">
                      <BookOpen size={18} />
                      <input
                        value={classroomCourseName}
                        onChange={(event) => setClassroomCourseName(event.target.value)}
                        placeholder="Operating Systems"
                      />
                    </div>
                  </label>

                  <button
                    className="onboarding-primary-btn mapping-add-btn"
                    type="button"
                    onClick={addClassroomMapping}
                    disabled={!selectedClassroomValue.trim() || !classroomCourseName.trim() || mappings.length >= 8}
                  >
                    Add Classroom Mapping
                  </button>
                </div>
              </>
            )}

            <div className="mapping-list">
              {mappings.map((mapping) => (
                <div className="mapping-row" key={mapping.id}>
                  <span>{mapping.group}</span>
                  <strong>{mapping.course}</strong>
                  <button
                    type="button"
                    aria-label="Delete mapping"
                    onClick={() => setMappings((current) => current.filter((item) => item.id !== mapping.id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button className="onboarding-text-link" type="button" onClick={next}>
              Skip this step →
            </button>
            <p className="mapping-helper">You can always add more mappings from the dashboard later</p>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-mapping-step">
            <div className="onboarding-step-heading">
              <h1>Enter your weekly timetable</h1>
              <p>Add day, time, subject, and room so the chatbot can answer schedule questions.</p>
            </div>

            <div className="mapping-form">
              <label className="onboarding-field">
                <span>Day</span>
                <div className="onboarding-input-wrap">
                  <BookOpen size={18} />
                  <select value={timetableForm.day} onChange={(event) => setTimetableForm((current) => ({ ...current, day: event.target.value }))}>
                    {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </div>
              </label>

              <label className="onboarding-field">
                <span>Time slot</span>
                <div className="onboarding-input-wrap">
                  <input type="time" value={timetableForm.startTime} onChange={(event) => setTimetableForm((current) => ({ ...current, startTime: event.target.value }))} />
                  <input type="time" value={timetableForm.endTime} onChange={(event) => setTimetableForm((current) => ({ ...current, endTime: event.target.value }))} />
                </div>
              </label>

              <label className="onboarding-field">
                <span>Subject name</span>
                <div className="onboarding-input-wrap">
                  <BookOpen size={18} />
                  <input value={timetableForm.subject} onChange={(event) => setTimetableForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Operating Systems" />
                </div>
              </label>

              <label className="onboarding-field">
                <span>Room number</span>
                <div className="onboarding-input-wrap">
                  <Building2 size={18} />
                  <input value={timetableForm.room} onChange={(event) => setTimetableForm((current) => ({ ...current, room: event.target.value }))} placeholder="CS-4" />
                </div>
              </label>

              <button className="onboarding-primary-btn mapping-add-btn" type="button" onClick={addTimetableEntry} disabled={!timetableForm.subject.trim()}>
                Add Class
              </button>
            </div>

            <div className="mapping-list">
              {timetableEntries.map((entry) => (
                <div className="mapping-row" key={entry.id}>
                  <span>{entry.day} {entry.startTime}-{entry.endTime}</span>
                  <strong>{entry.subject} {entry.room ? `(${entry.room})` : ''}</strong>
                  <button
                    type="button"
                    aria-label="Delete timetable entry"
                    onClick={() => setTimetableEntries((current) => current.filter((item) => item.id !== entry.id))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="onboarding-done-step">
            <Confetti />
            <svg className="done-checkmark" viewBox="0 0 90 90" aria-hidden="true">
              <defs>
                <linearGradient id="doneGradient" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <path d="M24 47 L39 62 L68 30" />
            </svg>
            <h1>You're all set! 🎉</h1>
            <p>AcadPulse is now monitoring your academic life.</p>
            <div className="done-summary">
              {connectedSummary.map((line, index) => (
                <span key={line} style={{ '--delay': `${index * 0.12}s` }}>
                  {line}
                </span>
              ))}
            </div>
            <button className="onboarding-primary-btn" type="button" onClick={finishOnboarding}>
              Open Dashboard →
            </button>
          </div>
        )}
      </section>

      {qrModalOpen && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true">
          <div className="onboarding-qr-modal">
            <button className="chat-close-btn" type="button" onClick={() => setQrModalOpen(false)} aria-label="Close QR modal">
              <X size={18} />
            </button>
            <h2>Scan QR code to connect</h2>
            {qrState.loading && <div className="onboarding-qr-placeholder">Loading QR...</div>}
            {!qrState.loading && qrState.value && (
              <img className="onboarding-qr-image" src={qrState.value} alt="WhatsApp QR code" />
            )}
            {!qrState.loading && qrState.error && (
              <div className="onboarding-qr-placeholder error">{qrState.error}</div>
            )}
          </div>
        </div>
      )}
      {toast && <div className="onboarding-toast">{toast}</div>}
    </main>
  );
}
