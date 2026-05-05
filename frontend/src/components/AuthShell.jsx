import { useEffect, useState } from 'react';
import { GraduationCap, Bell, BookOpen, MessageCircle, Mail } from 'lucide-react';
import authPreviewNotifications from '../config/authPreviewNotifications';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const ICON_MAP = {
  whatsapp: { icon: MessageCircle, iconClass: 'auth-notif-icon-wa' },
  classroom: { icon: BookOpen,      iconClass: 'auth-notif-icon-cls' },
  gmail:     { icon: Mail,          iconClass: 'auth-notif-icon-gm' },
};

function toDisplayItem(raw, index) {
  const mapping = ICON_MAP[raw.iconType] ?? ICON_MAP.gmail;
  return {
    ...mapping,
    source:   raw.source,
    message:  raw.message,
    time:     raw.time,
    tag:      raw.tag,
    tagClass: raw.tagClass,
    delay:    index,
  };
}

export default function AuthShell({ children }) {
  const [notificationItems, setNotificationItems] = useState(authPreviewNotifications);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/public/preview-notifications`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setNotificationItems(data.map(toDisplayItem));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
