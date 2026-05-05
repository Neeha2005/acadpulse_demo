import {
  BrainCircuit,
  GraduationCap,
  RadioTower,
  Zap,
} from 'lucide-react';

const featureItems = [
  {
    icon: RadioTower,
    text: 'Connects WhatsApp, Gmail & Classroom',
  },
  {
    icon: BrainCircuit,
    text: 'AI that understands Roman Urdu',
  },
  {
    icon: Zap,
    text: 'Never miss a deadline again',
  },
];

export default function AuthShell({ children }) {
  return (
    <div className="auth-shell">
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

          <div className="auth-feature-list">
            {featureItems.map(({ icon: Icon, text }) => (
              <div className="auth-feature-item" key={text}>
                <span className="auth-feature-icon">
                  <Icon size={16} strokeWidth={2.1} />
                </span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-brand-quote">Built for Pakistani university students.</div>
      </aside>

      <div className="auth-form-side">{children}</div>
    </div>
  );
}
