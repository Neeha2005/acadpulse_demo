import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  GraduationCap,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  School,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import logoSrc from '../assets/acadpulse-logo.png';
import '../onboarding.css';

const TOTAL_STEPS = 7;
const STEP_LABELS = ['Welcome', 'Profile', 'Platforms', 'Setup', 'Mapping', 'Alerts', 'Done'];
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

function SecurityBadge({ level = 'private', tooltip }) {
  const [showTip, setShowTip] = useState(false);
  const isSensitive = level === 'sensitive';
  return (
    <span
      className={`ob-security-badge ${isSensitive ? 'sensitive' : 'private'}`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onFocus={() => setShowTip(true)}
      onBlur={() => setShowTip(false)}
      tabIndex={0}
      aria-label={`${isSensitive ? 'Sensitive' : 'Private'} data — ${tooltip}`}
    >
      {isSensitive ? <Lock size={10} /> : <ShieldCheck size={10} />}
      {isSensitive ? 'Sensitive' : 'Private'}
      {showTip && (
        <span className="ob-security-tooltip" role="tooltip">{tooltip}</span>
      )}
    </span>
  );
}

function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className={`ob-toast ob-toast-${type}`} role="alert" aria-live="polite">
      {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
      {message}
    </div>
  );
}

function StatusDot({ connected }) {
  return <span className={`ob-status-dot ${connected ? 'connected' : ''}`} />;
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      className={`ob-switch ${checked ? 'on' : ''}`}
      type="button"
      onClick={() => onChange(!checked)}
      aria-label={label}
      aria-pressed={checked}
    >
      <span />
    </button>
  );
}

function Confetti() {
  const colors = [
    '#cfa04a', '#d9aa50', '#f97316', '#22c55e',
    '#fbbf24', '#ef4444', '#84cc16', '#a78bfa',
  ];
  return (
    <div className="ob-confetti" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          style={{
            '--i': i,
            '--color': colors[i % colors.length],
            '--rot': `${(i * 47) % 360}deg`,
            '--size': `${6 + (i % 5) * 2}px`,
            '--left': `${(i * 3.2 + 2) % 96}%`,
            '--delay': `${(i * 0.13) % 2.4}s`,
            '--dur': `${2.2 + (i % 5) * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

function StepWelcome({ studentName }) {
  const features = [
    { icon: <Bell size={18} />, text: 'Smart deadline extraction from messages' },
    { icon: <Zap size={18} />, text: 'AI-powered urgency scoring' },
    { icon: <Sparkles size={18} />, text: 'Unified inbox from all your platforms' },
  ];

  return (
    <div className="ob-welcome">
      <div className="ob-welcome-orb ob-welcome-orb-1" aria-hidden="true" />
      <div className="ob-welcome-orb ob-welcome-orb-2" aria-hidden="true" />

      <div className="ob-logo-bounce">
        <div className="ob-logo-mark">
          <img src={logoSrc} alt="AcadPulse" className="ob-logo-img" />
        </div>
      </div>

      <div className="ob-welcome-copy">
        <div className="ob-est-pill">
          <Clock size={13} />
          About 3 minutes to complete
        </div>
        <h1 className="ob-welcome-title">
          Welcome, <span className="ob-gradient-text">{studentName}</span>!
        </h1>
        <p className="ob-welcome-subtitle">
          Let's set up your personalised academic dashboard. We'll connect your platforms and get you notified about what matters.
        </p>
      </div>

      <div className="ob-feature-list">
        {features.map((feature, i) => (
          <div
            key={i}
            className="ob-feature-item"
            style={{ '--delay': `${0.3 + i * 0.12}s` }}
          >
            <span className="ob-feature-icon">{feature.icon}</span>
            <span>{feature.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepProfile({ profile, setProfile, errors, setErrors }) {
  const [semOpen, setSemOpen] = useState(false);
  const semRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (semRef.current && !semRef.current.contains(e.target)) setSemOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fields = [
    {
      key: 'university',
      label: 'University',
      icon: <Building2 size={17} />,
      placeholder: 'FAST, LUMS, COMSATS…',
      required: true,
      badge: <SecurityBadge level="private" tooltip="Used to personalise your dashboard. Stored securely on our servers." />,
    },
    {
      key: 'degree',
      label: 'Degree Program',
      icon: <BookOpen size={17} />,
      placeholder: 'BS Computer Science',
      required: true,
      badge: <SecurityBadge level="private" tooltip="Helps classify your coursework. Never shared externally." />,
    },
    {
      key: 'section',
      label: 'Section / Group',
      icon: <Users size={17} />,
      placeholder: 'Section A (optional)',
      badge: <SecurityBadge level="private" tooltip="Optional field to help match your class groups automatically." />,
    },
  ];

  return (
    <div className="ob-form-step">
      <div className="ob-step-heading">
        <h1>Tell us about your studies</h1>
        <p>This helps AcadPulse personalise notifications and course mapping.</p>
      </div>

      <div className="ob-form-grid">
        {fields.map((field, i) => (
          <label
            key={field.key}
            className="ob-field"
            style={{ '--delay': `${i * 0.08}s` }}
          >
            <span className="ob-field-label">
              {field.label}
              {!field.required && <em> (optional)</em>}
              {field.badge}
            </span>
            <div className={`ob-input-wrap ${errors[field.key] ? 'has-error' : ''}`}>
              {field.icon}
              <input
                value={profile[field.key] || ''}
                onChange={(e) => {
                  setProfile((prev) => ({ ...prev, [field.key]: e.target.value }));
                  if (errors[field.key]) setErrors((prev) => ({ ...prev, [field.key]: '' }));
                }}
                placeholder={field.placeholder}
              />
            </div>
            {errors[field.key] && (
              <small className="ob-field-error">
                <AlertCircle size={12} /> {errors[field.key]}
              </small>
            )}
          </label>
        ))}

        <label className="ob-field" style={{ '--delay': '0.24s' }}>
          <span className="ob-field-label">
            Current Semester
            <SecurityBadge level="private" tooltip="Used to set up your academic calendar. Stays on your account." />
          </span>
          <div className="ob-input-wrap ob-semester-wrap" ref={semRef}>
            <GraduationCap size={17} />
            <button
              type="button"
              className="ob-semester-trigger"
              onClick={() => setSemOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={semOpen}
            >
              {profile.semester || '1st'}
            </button>
            {semOpen && (
              <ul className="ob-semester-dropdown" role="listbox" aria-label="Select semester">
                {SEMESTERS.map((sem) => (
                  <li
                    key={sem}
                    role="option"
                    aria-selected={profile.semester === sem}
                    className={profile.semester === sem ? 'selected' : ''}
                    onClick={() => {
                      setProfile((prev) => ({ ...prev, semester: sem }));
                      setSemOpen(false);
                    }}
                  >
                    {sem} Semester
                    {profile.semester === sem && <Check size={13} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

function StepPlatforms({ platforms, setPlatforms, connections, onOpenQr, API_BASE_URL, userId }) {
  const [platformError, setPlatformError] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleToggle = (key, val) => {
    const next = { ...platforms, [key]: val };
    if (!next.whatsapp && !next.gmail && !next.classroom) {
      setShaking(true);
      setPlatformError('Please keep at least one platform enabled.');
      setTimeout(() => setShaking(false), 600);
      return;
    }
    setPlatformError('');
    setPlatforms(next);
  };

  const cards = [
    {
      key: 'whatsapp',
      type: 'whatsapp',
      icon: <MessageCircle size={26} />,
      title: 'WhatsApp Groups',
      subtitle: 'Get notified from your class groups in real time',
      connected: connections.whatsapp,
      extra: connections.whatsapp ? (
        <span className="ob-platform-connected">Connected</span>
      ) : (
        <button className="ob-platform-action whatsapp" type="button" onClick={onOpenQr}>
          Scan QR to connect
        </button>
      ),
    },
    {
      key: 'gmail',
      type: 'gmail',
      icon: <Mail size={26} />,
      title: 'Gmail',
      subtitle: 'Monitor university emails and extract deadlines',
      connected: Boolean(connections.gmailEmail),
      extra: connections.gmailEmail ? (
        <span className="ob-platform-connected">Connected as {connections.gmailEmail}</span>
      ) : (
        <button
          className="ob-platform-action gmail"
          type="button"
          onClick={() => window.location.assign(`${API_BASE_URL}/auth/google${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`)}
        >
          Connect Gmail
        </button>
      ),
    },
    {
      key: 'classroom',
      type: 'classroom',
      icon: <School size={26} />,
      title: 'Google Classroom',
      subtitle: 'Sync coursework, materials, and announcements',
      connected: connections.classroomCourses > 0,
      extra: connections.classroomCourses > 0 ? (
        <span className="ob-platform-connected">Syncing {connections.classroomCourses} courses</span>
      ) : (
        <button
          className="ob-platform-action classroom"
          type="button"
          onClick={() => window.location.assign(`${API_BASE_URL}/auth/google${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`)}
        >
          Connect Classroom
        </button>
      ),
    },
  ];

  return (
    <div className="ob-platform-step">
      <div className="ob-step-heading">
        <h1>Connect your platforms</h1>
        <p>Select which platforms you'd like AcadPulse to monitor for you.</p>
      </div>

      {platformError && (
        <div className={`ob-platform-error ${shaking ? 'shake' : ''}`}>
          <AlertCircle size={15} /> {platformError}
        </div>
      )}

      <div className="ob-platform-stack">
        {cards.map((card, i) => (
          <div
            key={card.key}
            className={`ob-platform-card ${card.type} ${platforms[card.key] ? 'enabled' : ''}`}
            style={{ '--delay': `${i * 0.08}s` }}
          >
            <div className="ob-platform-main">
              <div className={`ob-platform-icon ${card.type}`}>{card.icon}</div>
              <div className="ob-platform-copy">
                <div className="ob-platform-title-row">
                  <h3>{card.title}</h3>
                  <StatusDot connected={card.connected} />
                </div>
                <p>{card.subtitle}</p>
              </div>
              <ToggleSwitch
                checked={platforms[card.key]}
                onChange={(val) => handleToggle(card.key, val)}
                label={`Toggle ${card.title}`}
              />
            </div>
            <div className={`ob-platform-extra ${platforms[card.key] ? 'open' : ''}`}>
              {card.extra}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepSetup({ platforms, connections, onOpenQr, API_BASE_URL, userId, onAutoAdvance }) {
  useEffect(() => {
    const allConnected = (
      (!platforms.whatsapp || connections.whatsapp)
      && (!platforms.gmail || Boolean(connections.gmailEmail))
      && (!platforms.classroom || connections.classroomCourses > 0)
    );
    if (allConnected) {
      const t = setTimeout(onAutoAdvance, 1500);
      return () => clearTimeout(t);
    }
  }, [platforms, connections, onAutoAdvance]);

  const sections = [];

  if (platforms.whatsapp && !connections.whatsapp) {
    sections.push(
      <div key="whatsapp" className="ob-setup-section">
        <div className="ob-setup-icon whatsapp"><MessageCircle size={22} /></div>
        <div className="ob-setup-body">
          <h3>WhatsApp Setup</h3>
          <p>Scan the QR code with your WhatsApp to start receiving group notifications.</p>
          <button className="ob-setup-btn whatsapp" type="button" onClick={onOpenQr}>
            Open QR Scanner
          </button>
        </div>
      </div>
    );
  } else if (platforms.whatsapp && connections.whatsapp) {
    sections.push(
      <div key="whatsapp-done" className="ob-setup-section connected">
        <div className="ob-setup-icon success"><CheckCircle2 size={22} /></div>
        <div className="ob-setup-body">
          <h3>WhatsApp Connected</h3>
          <p>Your WhatsApp groups are now being monitored.</p>
        </div>
      </div>
    );
  }

  if (platforms.gmail && !connections.gmailEmail) {
    sections.push(
      <div key="gmail" className="ob-setup-section">
        <div className="ob-setup-icon gmail"><Mail size={22} /></div>
        <div className="ob-setup-body">
          <h3>Gmail Setup</h3>
          <p>Authorise AcadPulse to read and classify your university emails.</p>
          <button
            className="ob-setup-btn gmail"
            type="button"
            onClick={() => window.location.assign(`${API_BASE_URL}/auth/google${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`)}
          >
            Connect Gmail
          </button>
        </div>
      </div>
    );
  } else if (platforms.gmail && connections.gmailEmail) {
    sections.push(
      <div key="gmail-done" className="ob-setup-section connected">
        <div className="ob-setup-icon success"><CheckCircle2 size={22} /></div>
        <div className="ob-setup-body">
          <h3>Gmail Connected</h3>
          <p>Connected as {connections.gmailEmail}</p>
        </div>
      </div>
    );
  }

  if (platforms.classroom) {
    if (connections.classroomCourses > 0) {
      sections.push(
        <div key="classroom-done" className="ob-setup-section connected">
          <div className="ob-setup-icon success"><CheckCircle2 size={22} /></div>
          <div className="ob-setup-body">
            <h3>Classroom Connected</h3>
            <p>Syncing {connections.classroomCourses} courses from Google Classroom.</p>
          </div>
        </div>
      );
    } else if (connections.gmailEmail) {
      sections.push(
        <div key="classroom" className="ob-setup-section connected">
          <div className="ob-setup-icon success"><CheckCircle2 size={22} /></div>
          <div className="ob-setup-body">
            <h3>Classroom Ready</h3>
            <p>Classroom will sync automatically once Gmail is fully authorised.</p>
          </div>
        </div>
      );
    }
  }

  if (sections.length === 0) {
    sections.push(
      <div key="all-done" className="ob-setup-section connected">
        <div className="ob-setup-icon success"><CheckCircle2 size={22} /></div>
        <div className="ob-setup-body">
          <h3>All platforms ready</h3>
          <p>Advancing automatically…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-setup-step">
      <div className="ob-step-heading">
        <h1>Connect your accounts</h1>
        <p>Authorise the platforms you selected. You can do this later from Settings.</p>
      </div>
      <div className="ob-setup-sections">{sections}</div>
    </div>
  );
}

function CourseAutocomplete({ value, onChange, onSelect, suggestions, placeholder }) {
  return (
    <div className="ob-autocomplete-wrap">
      <div className="ob-input-wrap">
        <BookOpen size={16} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'e.g. Natural Language Processing'}
        />
      </div>
      {suggestions.length > 0 && (
        <ul className="ob-suggestions">
          {suggestions.map((s) => (
            <li key={s.id || s.name} onClick={() => onSelect(s.name || s.id)}>
              {s.name || s.id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepMapping({
  platforms,
  detectedGroups,
  classroomCourses,
  connections,
  mappings,
  setMappings,
  showToast,
}) {
  const [waGroupInput, setWaGroupInput] = useState('');
  const [waCourseInput, setWaCourseInput] = useState('');
  const [waSuggestions, setWaSuggestions] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(detectedGroups[0] || '');
  const [gmailSender, setGmailSender] = useState('');
  const [gmailCourse, setGmailCourse] = useState('');
  const [gmailSuggestions, setGmailSuggestions] = useState([]);
  const waDebounceRef = useRef(null);
  const gmailDebounceRef = useRef(null);

  const getSuggestions = useCallback((query) => {
    if (!query.trim() || !classroomCourses.length) return [];
    const q = query.trim().toLowerCase();
    return classroomCourses
      .filter((c) => (c.name || c.id || '').toLowerCase().includes(q))
      .slice(0, 5);
  }, [classroomCourses]);

  const handleWaCourseChange = (val) => {
    setWaCourseInput(val);
    clearTimeout(waDebounceRef.current);
    waDebounceRef.current = setTimeout(() => setWaSuggestions(getSuggestions(val)), 300);
  };

  const handleGmailCourseChange = (val) => {
    setGmailCourse(val);
    clearTimeout(gmailDebounceRef.current);
    gmailDebounceRef.current = setTimeout(() => setGmailSuggestions(getSuggestions(val)), 300);
  };

  const addWaMapping = () => {
    const group = (detectedGroups.length ? selectedGroup : waGroupInput).trim();
    const course = waCourseInput.trim();
    if (!group || !course) return;
    if (mappings.some((m) => m.group === group && m.source_type === 'whatsapp')) {
      showToast('This group is already mapped', 'error');
      return;
    }
    setMappings((prev) => [...prev, {
      id: `wa-${group}-${prev.length}`,
      source_type: 'whatsapp',
      group,
      course,
    }]);
    setWaCourseInput('');
    setWaSuggestions([]);
    if (!detectedGroups.length) setWaGroupInput('');
  };

  const addGmailMapping = () => {
    const sender = gmailSender.trim();
    const course = gmailCourse.trim();
    if (!sender || !course) return;
    if (mappings.some((m) => m.group === sender && m.source_type === 'gmail')) {
      showToast('This sender is already mapped', 'error');
      return;
    }
    setMappings((prev) => [...prev, {
      id: `gmail-${sender}-${prev.length}`,
      source_type: 'gmail',
      group: sender,
      course,
    }]);
    setGmailSender('');
    setGmailCourse('');
    setGmailSuggestions([]);
  };

  const classroomAutoMapped = classroomCourses.slice(0, 4).map((c) => ({
    id: `cls-${c.id || c.name}`,
    source_type: 'classroom',
    group: c.name || c.id,
    course: c.name || c.id,
    readOnly: true,
  }));

  const allMappings = [...mappings, ...classroomAutoMapped];
  const hasAny = mappings.length > 0;

  return (
    <div className="ob-mapping-step">
      <div className="ob-step-heading">
        <h1>Map groups to courses</h1>
        <p>Link each WhatsApp group or Gmail sender to the course it belongs to.</p>
      </div>

      {platforms.whatsapp && (
        <div className="ob-mapping-form">
          <div className="ob-mapping-form-label">
            <MessageCircle size={14} /> WhatsApp group → course
          </div>
          <label className="ob-field">
            <span className="ob-field-label">WhatsApp group</span>
            <div className="ob-input-wrap">
              <MessageCircle size={16} />
              {detectedGroups.length > 0 ? (
                <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
                  {detectedGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={waGroupInput}
                  onChange={(e) => setWaGroupInput(e.target.value)}
                  placeholder="Group name (e.g. FAST NLP Group)"
                />
              )}
            </div>
          </label>

          <label className="ob-field">
            <span className="ob-field-label">Course name</span>
            <CourseAutocomplete
              value={waCourseInput}
              onChange={handleWaCourseChange}
              onSelect={(name) => { setWaCourseInput(name); setWaSuggestions([]); }}
              suggestions={waSuggestions}
              placeholder="e.g. Natural Language Processing"
            />
          </label>

          <button
            className="ob-primary-btn ob-mapping-add-btn"
            type="button"
            onClick={addWaMapping}
            disabled={!(detectedGroups.length ? selectedGroup : waGroupInput).trim() || !waCourseInput.trim()}
          >
            Add
          </button>
        </div>
      )}

      {platforms.gmail && (
        <div className="ob-mapping-form">
          <div className="ob-mapping-form-label">
            <Mail size={14} /> Gmail sender → course
          </div>
          <label className="ob-field">
            <span className="ob-field-label">Sender email or keyword</span>
            <div className="ob-input-wrap">
              <Mail size={16} />
              <input
                value={gmailSender}
                onChange={(e) => setGmailSender(e.target.value)}
                placeholder="e.g. lms@fast.edu.pk"
                type="text"
              />
            </div>
          </label>

          <label className="ob-field">
            <span className="ob-field-label">Course name</span>
            <CourseAutocomplete
              value={gmailCourse}
              onChange={handleGmailCourseChange}
              onSelect={(name) => { setGmailCourse(name); setGmailSuggestions([]); }}
              suggestions={gmailSuggestions}
              placeholder="e.g. Operating Systems"
            />
          </label>

          <button
            className="ob-primary-btn ob-mapping-add-btn"
            type="button"
            onClick={addGmailMapping}
            disabled={!gmailSender.trim() || !gmailCourse.trim()}
          >
            Add
          </button>
        </div>
      )}

      {allMappings.length > 0 && (
        <div className="ob-mapping-list">
          {allMappings.map((m) => (
            <div key={m.id} className={`ob-mapping-row ${m.readOnly ? 'read-only' : ''}`}>
              <span className="ob-mapping-source-badge">
                {m.source_type === 'whatsapp' ? <MessageCircle size={11} /> : m.source_type === 'gmail' ? <Mail size={11} /> : <School size={11} />}
                {m.source_type}
              </span>
              <span className="ob-mapping-group">{m.group}</span>
              <span className="ob-mapping-arrow">→</span>
              <strong className="ob-mapping-course">{m.course}</strong>
              {m.readOnly ? (
                <span className="ob-mapping-auto-badge">
                  <CheckCircle2 size={12} /> Auto
                </span>
              ) : (
                <button
                  type="button"
                  aria-label="Remove mapping"
                  className="ob-mapping-del"
                  onClick={() => setMappings((prev) => prev.filter((x) => x.id !== m.id))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!hasAny && (
        <p className="ob-mapping-helper">
          You can add course mappings later from the Courses page.
        </p>
      )}
    </div>
  );
}

function StepNotifications({ prefs, setPrefs, platforms, showToast }) {
  const rows = [
    {
      key: 'desktopPopups',
      icon: <Smartphone size={20} />,
      title: 'Desktop Popups',
      description: 'Show browser notifications for urgent items',
      locked: false,
      onEnable: async () => {
        if (!('Notification' in window)) return false;
        const result = await window.Notification.requestPermission();
        return result === 'granted';
      },
      warning: 'Browser permission was denied. Enable notifications in your browser settings to use this feature.',
    },
    {
      key: 'morningDigest',
      icon: <Moon size={20} />,
      title: 'Morning Digest',
      description: 'Daily summary at your preferred time',
      locked: false,
      extra: prefs.morningDigest && (
        <div className="ob-time-picker">
          <Clock size={14} />
          <input
            type="time"
            value={prefs.digestTime || '08:00'}
            onChange={(e) => setPrefs((prev) => ({ ...prev, digestTime: e.target.value }))}
          />
        </div>
      ),
    },
    {
      key: 'criticalAlerts',
      icon: <AlertCircle size={20} />,
      title: 'Critical Alerts',
      description: 'High-urgency deadlines — always on',
      locked: true,
      badge: (
        <SecurityBadge
          level="sensitive"
          tooltip="System-controlled — cannot be disabled. Ensures you never miss critical deadlines."
        />
      ),
    },
    ...(platforms.whatsapp
      ? [{
          key: 'whatsappReminders',
          icon: <MessageCircle size={20} />,
          title: 'WhatsApp Reminders',
          description: 'Deadline reminders sent to your WhatsApp',
          locked: false,
        }]
      : []),
  ];

  const handleToggle = async (row, val) => {
    if (row.locked) return;
    if (val && row.onEnable) {
      const allowed = await row.onEnable();
      if (!allowed) {
        if (row.warning) showToast(row.warning, 'error');
        return;
      }
    }
    setPrefs((prev) => ({ ...prev, [row.key]: val }));
  };

  return (
    <div className="ob-notif-step">
      <div className="ob-step-heading">
        <h1>Notification preferences</h1>
        <p>Choose how AcadPulse keeps you in the loop.</p>
      </div>

      <div className="ob-notif-rows">
        {rows.map((row) => (
          <div key={row.key} className={`ob-notif-row ${row.locked ? 'locked' : ''}`}>
            <div className="ob-notif-icon-wrap">{row.icon}</div>
            <div className="ob-notif-body">
              <div className="ob-notif-title-row">
                <strong>{row.title}</strong>
                {row.locked && <Lock size={12} className="ob-lock-icon" />}
                {row.badge}
              </div>
              <p>{row.description}</p>
              {row.extra}
            </div>
            <ToggleSwitch
              checked={row.locked ? true : Boolean(prefs[row.key])}
              onChange={(val) => handleToggle(row, val)}
              label={`Toggle ${row.title}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepDone({ studentName, connectedSummary, onFinish }) {
  return (
    <div className="ob-done-step">
      <Confetti />

      <svg className="ob-done-checkmark" viewBox="0 0 90 90" aria-hidden="true">
        <defs>
          <linearGradient id="checkGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--warning)" />
          </linearGradient>
        </defs>
        <circle cx="45" cy="45" r="38" className="ob-check-circle" />
        <path d="M26 47 L40 62 L67 30" className="ob-check-path" />
      </svg>

      <div className="ob-done-copy">
        <h1>
          You're all set, <span className="ob-gradient-text">{studentName}</span>!
        </h1>
        <p>AcadPulse is ready to keep you on top of your academic life.</p>
      </div>

      <div className="ob-done-summary">
        {connectedSummary.map((line, i) => (
          <div key={line} className="ob-done-summary-row" style={{ '--delay': `${i * 0.1}s` }}>
            <Check size={14} className="ob-done-check-icon" />
            <span>{line}</span>
          </div>
        ))}
      </div>

      <button className="ob-primary-btn ob-done-cta" type="button" onClick={onFinish}>
        Open Dashboard →
      </button>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { API_BASE_URL, apiFetch, user, authUser } = useAppContext();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState('forward');
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [resumeBanner, setResumeBanner] = useState(false);
  const [detectedGroups, setDetectedGroups] = useState([]);
  const [classroomCourses, setClassroomCourses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrState, setQrState] = useState({ loading: false, value: '', error: '' });
  const [profile, setProfile] = useState({
    university: localStorage.getItem('acadpulse_university') || '',
    degree: localStorage.getItem('acadpulse_degree') || '',
    semester: localStorage.getItem('acadpulse_semester') || '1st',
    section: localStorage.getItem('acadpulse_section') || '',
  });
  const [platforms, setPlatforms] = useState({ whatsapp: true, gmail: true, classroom: true });
  const [connections, setConnections] = useState({
    whatsapp: false,
    gmailEmail: '',
    classroomCourses: 0,
  });
  const [prefs, setPrefs] = useState({
    desktopPopups: false,
    morningDigest: false,
    digestTime: '08:00',
    criticalAlerts: true,
    whatsappReminders: false,
  });

  const studentName = user.fullName || localStorage.getItem('acadpulse_user') || 'Scholar';
  const userId = authUser?.id || user.id || localStorage.getItem('acadpulse_user_id') || '';

  const progress = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);

  const connectedSummary = useMemo(() => {
    const lines = [];
    if (platforms.whatsapp) lines.push(`WhatsApp ${connections.whatsapp ? 'connected' : 'selected'}`);
    if (platforms.gmail) lines.push(`Gmail ${connections.gmailEmail ? 'connected' : 'selected'}`);
    if (platforms.classroom) lines.push(`Classroom ${connections.classroomCourses > 0 ? `(${connections.classroomCourses} courses)` : 'selected'}`);
    lines.push(`${mappings.length} course mapping${mappings.length !== 1 ? 's' : ''} added`);
    return lines;
  }, [connections, mappings.length, platforms]);

  const onboardingData = useMemo(() => ({
    profile,
    platforms,
    mappings,
    preferences: prefs,
  }), [profile, platforms, mappings, prefs]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [groups, status, classroom, onboarding] = await Promise.allSettled([
          apiFetch('/whatsapp/groups', {}, false),
          apiFetch('/whatsapp/status', {}, false),
          apiFetch('/classroom/courses', {}, false),
          apiFetch(`/onboarding/status${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, {}, false),
        ]);

        if (!mounted) return;

        if (groups.status === 'fulfilled') {
          const raw = Array.isArray(groups.value?.groups) ? groups.value.groups : [];
          setDetectedGroups(raw.map((g) => g.group_name || g.name || g.group_id).filter(Boolean));
        }
        if (classroom.status === 'fulfilled') {
          setClassroomCourses(Array.isArray(classroom.value?.courses) ? classroom.value.courses : []);
        }
        setConnections((prev) => ({
          ...prev,
          whatsapp: status.status === 'fulfilled' && status.value?.whatsapp?.status === 'connected',
          classroomCourses: classroom.status === 'fulfilled' && Array.isArray(classroom.value?.courses)
            ? classroom.value.courses.length : 0,
        }));

        if (onboarding.status === 'rejected') {
          showToast('Could not load your onboarding progress — starting fresh', 'error');
        }

        if (
          onboarding.status === 'fulfilled'
          && !onboarding.value?.completed
          && Number(onboarding.value?.current_step) > 1
        ) {
          setResumeBanner(true);
          setStep(Math.min(Number(onboarding.value.current_step), TOTAL_STEPS));
          const saved = onboarding.value?.data;
          if (saved) {
            if (saved.profile) setProfile((prev) => ({ ...prev, ...saved.profile }));
            if (saved.platforms) setPlatforms((prev) => ({ ...prev, ...saved.platforms }));
            if (Array.isArray(saved.mappings) && saved.mappings.length > 0) setMappings(saved.mappings);
            if (saved.preferences) setPrefs((prev) => ({ ...prev, ...saved.preferences }));
          }
        }
      } catch {
        if (mounted) setDetectedGroups([]);
      }
    };
    load();
    return () => { mounted = false; };
  }, [apiFetch, userId]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const clearToast = useCallback(() => setToast({ message: '', type: 'success' }), []);

  const saveProgress = useCallback(async (completedStep = step, data = onboardingData) => {
    try {
      await apiFetch('/onboarding/progress', {
        method: 'POST',
        body: JSON.stringify({ ...(userId ? { user_id: userId } : {}), step: completedStep, data }),
      }, false);
    } catch {
      showToast('Progress save failed — will retry', 'error');
    }
  }, [apiFetch, onboardingData, showToast, step, userId]);

  const validateStep = useCallback(() => {
    if (step === 2) {
      const next = {};
      if (!profile.university.trim()) next.university = 'University name is required';
      if (!profile.degree.trim()) next.degree = 'Degree program is required';
      setErrors(next);
      return Object.keys(next).length === 0;
    }
    return true;
  }, [profile, step]);

  const goNext = useCallback(async () => {
    if (!validateStep()) return;
    if (step === 2) {
      localStorage.setItem('acadpulse_university', profile.university);
      localStorage.setItem('acadpulse_degree', profile.degree);
      localStorage.setItem('acadpulse_semester', profile.semester);
      localStorage.setItem('acadpulse_section', profile.section);
    }
    if (step === 5 && mappings.length > 0) {
      const userMappings = mappings.filter((m) => !m.readOnly);
      let failCount = 0;
      for (const m of userMappings) {
        try {
          await apiFetch('/course-source-mappings', {
            method: 'POST',
            body: JSON.stringify({
              course_id: m.course,
              source_type: m.source_type,
              source_reference_id: m.group,
              ...(userId ? { user_id: userId } : {}),
            }),
          }, false);
        } catch {
          failCount += 1;
        }
      }
      if (failCount > 0) {
        showToast(
          `${failCount} mapping${failCount > 1 ? 's' : ''} could not be saved — check your connection`,
          'error',
        );
      }
    }
    const nextStep = Math.min(step + 1, TOTAL_STEPS);
    await saveProgress(nextStep);
    setDirection('forward');
    setStep(nextStep);
  }, [validateStep, step, profile, mappings, apiFetch, userId, showToast, saveProgress]);

  const goBack = useCallback(() => {
    setDirection('back');
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const skip = useCallback(async () => {
    const nextStep = Math.min(step + 1, TOTAL_STEPS);
    await saveProgress(nextStep);
    setDirection('forward');
    setStep(nextStep);
  }, [saveProgress, step]);

  const openWhatsappQr = useCallback(async () => {
    setQrModalOpen(true);
    setQrState({ loading: true, value: '', error: '' });
    try {
      const payload = await apiFetch('/whatsapp/qr', {}, false);
      const raw = payload?.qr || payload?.qr_code || '';
      const img = payload?.image || payload?.qr_image
        || (raw ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(raw)}` : '');
      setQrState({ loading: false, value: img, error: img ? '' : 'QR code not available yet.' });
    } catch {
      setQrState({ loading: false, value: '', error: 'Make sure the WhatsApp bridge is running.' });
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!qrModalOpen || connections.whatsapp) return;
    const interval = setInterval(async () => {
      try {
        const payload = await apiFetch('/whatsapp/status', {}, false);
        if (payload?.whatsapp?.status === 'connected') {
          clearInterval(interval);
          setConnections((prev) => ({ ...prev, whatsapp: true }));
          setQrModalOpen(false);
          showToast('WhatsApp connected!', 'success');
        }
      } catch {
        /* network blip — keep polling */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [qrModalOpen, connections.whatsapp, apiFetch, showToast]);

  const finishOnboarding = useCallback(async () => {
    localStorage.setItem('acadpulse_onboarding_complete', 'true');
    try {
      await apiFetch('/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({ ...(userId ? { user_id: userId } : {}), data: onboardingData }),
      }, false);
    } catch {
      apiFetch('/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({ ...(userId ? { user_id: userId } : {}), data: onboardingData }),
      }, false).catch(() => {});
    }
    navigate('/dashboard', { replace: true });
  }, [apiFetch, navigate, onboardingData, userId]);

  const showSkip = step >= 3 && step <= 6;
  const showBack = step > 1;
  const isLastStep = step === TOTAL_STEPS;

  return (
    <main className="ob-screen">
      <div className="ob-progress-bar" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="ob-topbar">
        <button
          className={`ob-back-btn ${showBack ? '' : 'invisible'}`}
          type="button"
          onClick={goBack}
          aria-label="Go back"
        >
          ← Back
        </button>

        <div className="ob-step-dots" aria-label="Onboarding progress">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <span
                key={label}
                className={`ob-step-dot ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                aria-label={`Step ${n}: ${label} ${done ? '(complete)' : active ? '(current)' : ''}`}
                title={label}
              >
                {done ? <Check size={10} /> : n}
              </span>
            );
          })}
        </div>

        {showSkip ? (
          <button className="ob-skip-btn" type="button" onClick={skip}>
            Skip →
          </button>
        ) : (
          <span className="ob-topbar-placeholder" />
        )}
      </div>

      {resumeBanner && (
        <div className="ob-resume-banner">
          <Sparkles size={14} />
          Picking up where you left off
          <button type="button" className="ob-resume-close" onClick={() => setResumeBanner(false)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      <div
        className={`ob-card ${direction === 'forward' ? 'slide-forward' : 'slide-back'}`}
        key={step}
      >
        {step === 1 && <StepWelcome studentName={studentName} />}
        {step === 2 && (
          <StepProfile
            profile={profile}
            setProfile={setProfile}
            errors={errors}
            setErrors={setErrors}
          />
        )}
        {step === 3 && (
          <StepPlatforms
            platforms={platforms}
            setPlatforms={setPlatforms}
            connections={connections}
            onOpenQr={openWhatsappQr}
            API_BASE_URL={API_BASE_URL}
            userId={userId}
          />
        )}
        {step === 4 && (
          <StepSetup
            platforms={platforms}
            connections={connections}
            onOpenQr={openWhatsappQr}
            API_BASE_URL={API_BASE_URL}
            userId={userId}
            onAutoAdvance={goNext}
          />
        )}
        {step === 5 && (
          <StepMapping
            platforms={platforms}
            detectedGroups={detectedGroups}
            classroomCourses={classroomCourses}
            connections={connections}
            mappings={mappings}
            setMappings={setMappings}
            showToast={showToast}
          />
        )}
        {step === 6 && (
          <StepNotifications
            prefs={prefs}
            setPrefs={setPrefs}
            platforms={platforms}
            showToast={showToast}
          />
        )}
        {step === 7 && (
          <StepDone
            studentName={studentName}
            connectedSummary={connectedSummary}
            onFinish={finishOnboarding}
          />
        )}

        {!isLastStep && (
          <div className="ob-card-footer">
            <button className="ob-primary-btn ob-continue-btn" type="button" onClick={goNext}>
              {step === TOTAL_STEPS - 1
                ? 'Finish setup'
                : (step === 5 && mappings.length === 0)
                  ? 'Skip for Now →'
                  : 'Continue →'}
            </button>
          </div>
        )}
      </div>

      {qrModalOpen && (
        <div className="ob-modal-backdrop" role="dialog" aria-modal="true" aria-label="WhatsApp QR code">
          <div className="ob-qr-modal">
            <button
              className="ob-qr-close"
              type="button"
              onClick={() => setQrModalOpen(false)}
              aria-label="Close QR modal"
            >
              <X size={18} />
            </button>
            <div className="ob-qr-icon"><MessageCircle size={28} /></div>
            <h2>Scan to connect WhatsApp</h2>
            <p>Open WhatsApp on your phone → Linked Devices → Link a Device</p>
            {qrState.loading && <div className="ob-qr-skeleton" aria-label="Loading QR code" />}
            {!qrState.loading && qrState.value && (
              <img className="ob-qr-image" src={qrState.value} alt="WhatsApp QR code" />
            )}
            {!qrState.loading && qrState.error && (
              <div className="ob-qr-error">
                <AlertCircle size={16} /> {qrState.error}
              </div>
            )}
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} onDismiss={clearToast} />
    </main>
  );
}
