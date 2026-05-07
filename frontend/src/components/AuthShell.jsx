import { GraduationCap } from 'lucide-react';

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

        </div>

        <div className="auth-brand-quote">Built for Pakistani university students.</div>
      </aside>

      <div className="auth-form-side">{children}</div>
    </div>
  );
}
