import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const STEPS = [
  {
    key: 'profile',
    title: 'Profile',
    icon: 'fa-user-graduate',
    route: null,
    action: 'Review account',
  },
  {
    key: 'integrations',
    title: 'Connect Sources',
    icon: 'fa-link',
    route: '/integrations',
    action: 'Open integrations',
  },
  {
    key: 'courses',
    title: 'Course Dictionary',
    icon: 'fa-book',
    route: '/courses',
    action: 'Add courses',
  },
  {
    key: 'mappings',
    title: 'Source Mappings',
    icon: 'fa-route',
    route: '/integrations/whatsapp',
    action: 'Map groups',
  },
  {
    key: 'notifications',
    title: 'Live Feed',
    icon: 'fa-bell',
    route: '/dashboard',
    action: 'View dashboard',
  },
  {
    key: 'chatbot',
    title: 'Chatbot',
    icon: 'fa-comments',
    route: '/chatbot',
    action: 'Try chatbot',
  },
];

function StepStatus({ complete }) {
  return (
    <span className={`trend-pill ${complete ? 'trend-pill-messages' : 'trend-pill-pending'}`}>
      {complete ? 'Ready' : 'Needs setup'}
    </span>
  );
}

export default function Onboarding() {
  const { apiFetch, user, tasks, notifications } = useAppContext();
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readiness, setReadiness] = useState({
    courses: 0,
    mappings: 0,
    whatsappStatus: 'unknown',
    groqModel: '',
    groqError: '',
  });

  const loadReadiness = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [coursesPayload, whatsappMappingsPayload, classroomMappingsPayload, whatsappPayload, groqPayload] = await Promise.all([
        apiFetch('/courses', {}, false),
        apiFetch('/course-source-mappings?source_type=whatsapp', {}, false),
        apiFetch('/course-source-mappings?source_type=classroom', {}, false),
        apiFetch('/whatsapp/status', {}, false),
        apiFetch('/groq/status', {}, false),
      ]);

      setReadiness({
        courses: Array.isArray(coursesPayload?.courses) ? coursesPayload.courses.length : 0,
        mappings: [
          ...(Array.isArray(whatsappMappingsPayload?.mappings) ? whatsappMappingsPayload.mappings : []),
          ...(Array.isArray(classroomMappingsPayload?.mappings) ? classroomMappingsPayload.mappings : []),
        ].length,
        whatsappStatus: whatsappPayload?.whatsapp?.status || 'unknown',
        groqModel: groqPayload?.model || '',
        groqError: groqPayload?.last_error || '',
      });
    } catch (loadError) {
      setError(loadError.message || 'Unable to load onboarding readiness.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  const stepState = useMemo(() => {
    const profileReady = Boolean(user.fullName && user.email);
    const integrationReady = readiness.whatsappStatus === 'connected' || notifications.length > 0;
    const coursesReady = readiness.courses > 0;
    const mappingsReady = readiness.mappings > 0;
    const notificationsReady = notifications.length > 0 || tasks.length > 0;
    const chatbotReady = Boolean(readiness.groqModel) && !readiness.groqError;

    return {
      profile: profileReady,
      integrations: integrationReady,
      courses: coursesReady,
      mappings: mappingsReady,
      notifications: notificationsReady,
      chatbot: chatbotReady,
    };
  }, [notifications.length, readiness, tasks.length, user.email, user.fullName]);

  const completedCount = STEPS.filter((step) => stepState[step.key]).length;
  const activeStep = STEPS[activeIndex];
  const activeComplete = stepState[activeStep.key];
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  const stepDetails = {
    profile: {
      metric: user.email || 'No email saved',
      body: 'Confirm the dashboard has your name and email so synced content belongs to the right student profile.',
    },
    integrations: {
      metric: `WhatsApp: ${readiness.whatsappStatus}`,
      body: 'Connect WhatsApp, Gmail, and Classroom before expecting automatic task ingestion.',
    },
    courses: {
      metric: `${readiness.courses} course(s)`,
      body: 'Add course codes and aliases like OS, DSA, AI, and DBMS so classifiers can route messages correctly.',
    },
    mappings: {
      metric: `${readiness.mappings} mapping(s)`,
      body: 'Map WhatsApp groups and Classroom courses to local AcadPulse courses.',
    },
    notifications: {
      metric: `${notifications.length} notification(s), ${tasks.length} task(s)`,
      body: 'Once sources are connected, incoming academic items should appear on the dashboard.',
    },
    chatbot: {
      metric: readiness.groqError ? 'Needs Groq check' : readiness.groqModel || 'Model not loaded',
      body: 'Use the chatbot after DB context and CRUD actions are enabled.',
    },
  };

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">SETUP FLOW</span>
          <h1 className="hero-title">Step-by-step Onboarding</h1>
          <p>Walk through the minimum setup needed for automatic deadlines, mappings, and chatbot actions.</p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Progress</span>
            <strong>{progressPct}%</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Ready</span>
            <strong>{completedCount}/{STEPS.length}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Current</span>
            <strong>{activeIndex + 1}</strong>
          </div>
        </div>
      </section>

      <div className="content-grid" style={{ gridTemplateColumns: 'minmax(280px, 0.42fr) minmax(0, 1fr)' }}>
        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <div>
              <h2 className="panel-title"><i className="fa-solid fa-list-check text-primary"></i> Setup Steps</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Complete these in order for the cleanest first run.
              </p>
            </div>
            <button className="text-btn gradient-link" onClick={loadReadiness} disabled={loading}>
              {loading ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          <div className="tasks-list" style={{ padding: 24 }}>
            {STEPS.map((step, index) => (
              <button
                key={step.key}
                type="button"
                className="task-card"
                onClick={() => setActiveIndex(index)}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderColor: index === activeIndex ? 'var(--primary)' : undefined,
                }}
              >
                <div className="task-top">
                  <span className="task-course">Step {index + 1}</span>
                  <StepStatus complete={stepState[step.key]} />
                </div>
                <h3 className="task-title"><i className={`fa-solid ${step.icon}`}></i> {step.title}</h3>
              </button>
            ))}
          </div>
        </div>

        <div className="panel glass-panel panel-accent">
          <div className="panel-header">
            <div>
              <h2 className="panel-title"><i className={`fa-solid ${activeStep.icon} text-primary`}></i> {activeStep.title}</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                {stepDetails[activeStep.key].body}
              </p>
            </div>
            <StepStatus complete={activeComplete} />
          </div>

          <div style={{ padding: 24, display: 'grid', gap: 18 }}>
            {error && (
              <div style={{ color: 'var(--urgent)', padding: 12, background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)', fontSize: 13 }}>
                <i className="fa-solid fa-triangle-exclamation"></i> {error}
              </div>
            )}

            <div className="stat-card glass-card" style={{ minHeight: 130 }}>
              <div className="stat-header">
                <div className="stat-icon stat-icon-messages"><i className={`fa-solid ${activeStep.icon}`}></i></div>
                <div className="stat-trend trend-pill trend-pill-messages">live readiness</div>
              </div>
              <div className="stat-value stat-value-messages" style={{ fontSize: 28 }}>{stepDetails[activeStep.key].metric}</div>
              <div className="stat-label">{activeComplete ? 'This step is ready' : 'This step needs attention'}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
                disabled={activeIndex === 0}
              >
                <i className="fa-solid fa-arrow-left"></i> Back
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setActiveIndex((current) => Math.min(STEPS.length - 1, current + 1))}
                disabled={activeIndex === STEPS.length - 1}
              >
                Next <i className="fa-solid fa-arrow-right"></i>
              </button>
              {activeStep.route && (
                <Link className="btn btn-outline" to={activeStep.route}>
                  <i className="fa-solid fa-up-right-from-square"></i> {activeStep.action}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
