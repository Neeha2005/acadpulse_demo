import { GraduationCap, Bell, BookOpen, MessageCircle, Mail } from 'lucide-react';

const notificationItems = [
  {
    icon: MessageCircle,
    iconClass: 'auth-notif-icon-wa',
    source: 'NLP Group',
    message: 'Assignment 3 due Friday at 11:59 PM',
    time: '2m ago',
    tag: 'Deadline',
    tagClass: 'auth-notif-tag-urgent',
    delay: 0,
  },
  {
    icon: BookOpen,
    iconClass: 'auth-notif-icon-cls',
    source: 'Operating Systems',
    message: 'Mid-term marks have been posted',
    time: '14m ago',
    tag: 'Grades',
    tagClass: 'auth-notif-tag-info',
    delay: 1,
  },
  {
    icon: Mail,
    iconClass: 'auth-notif-icon-gm',
    source: 'university@fast.edu',
    message: 'Fee submission deadline: Dec 15',
    time: '1h ago',
    tag: 'Finance',
    tagClass: 'auth-notif-tag-warn',
    delay: 2,
  },
];

export default function AuthShell({ children }) {
  return (
    <div className="auth-shell auth-shell-enter">
      <div className="auth-bg-orb auth-bg-orb-1" aria-hidden="true"></div>
      <div className="auth-bg-orb auth-bg-orb-2" aria-hidden="true"></div>
      <div className="auth-bg-orb auth-bg-orb-3" aria-hidden="true"></div>
      <div className="auth-bg-orb auth-bg-orb-4" aria-hidden="true"></div>

      <aside className="auth-brand-panel">
        <div className="auth-brand-orb" aria-hidden="true"></div>
        <div className="auth-brand-float auth-brand-float-a" aria-hidden="true"></div>
        <div className="auth-brand-float auth-brand-float-b" aria-hidden="true"></div>
        <div className="auth-brand-float auth-brand-float-c" aria-hidden="true"></div>
        <div className="auth-brand-main">
          <div className="auth-brand-logo">
            <div className="auth-brand-mark">
              <GraduationCap size={38} strokeWidth={2.2} />
            </div>
            <div className="auth-brand-copy">
              <h1>AcadPulse</h1>
              <p>Your academic life, unified.</p>
            </div>
          </div>

          <div className="auth-notif-preview">
            <div className="auth-notif-preview-header">
              <Bell size={13} strokeWidth={2.2} />
              <span>Live notifications</span>
              <span className="auth-notif-live-dot" aria-hidden="true"></span>
            </div>
            <div className="auth-notif-list">
              {notificationItems.map(({ icon: Icon, iconClass, source, message, time, tag, tagClass, delay }) => (
                <div
                  className="auth-notif-item"
                  key={source}
                  style={{ animationDelay: `${delay * 0.18 + 0.15}s` }}
                >
                  <span className={`auth-notif-icon ${iconClass}`}>
                    <Icon size={14} strokeWidth={2.2} />
                  </span>
                  <div className="auth-notif-body">
                    <div className="auth-notif-meta">
                      <strong>{source}</strong>
                      <span className={`auth-notif-tag ${tagClass}`}>{tag}</span>
                    </div>
                    <p>{message}</p>
                    <time>{time}</time>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="auth-brand-quote">Built for Pakistani university students.</div>
      </aside>

      <div className="auth-form-side">{children}</div>
    </div>
  );
}
