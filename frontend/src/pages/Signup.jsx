import { BrainCircuit, GraduationCap, Smartphone, Globe, Zap, RadioTower } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

const options = [
  {
    key: 'google',
    title: 'Continue with Google',
    subtitle: 'Use your university Gmail account',
    icon: Globe,
    iconClass: 'signup-method-google',
    path: '/signup/google',
    cardClass: 'signup-choice-card-left',
  },
  {
    key: 'whatsapp',
    title: 'Continue with WhatsApp',
    subtitle: 'Use your WhatsApp number to verify',
    icon: Smartphone,
    iconClass: 'signup-method-whatsapp',
    path: '/signup/whatsapp',
    cardClass: 'signup-choice-card-right',
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState('');

  const chooseMethod = (option) => {
    setSelectedMethod(option.key);
    window.setTimeout(() => navigate(option.path), 300);
  };

  return (
    <div className="signup-onboarding">
      <div className="signup-floating-orb orb-a"></div>
      <div className="signup-floating-orb orb-b"></div>
      <div className="signup-floating-orb orb-c"></div>

      <div className="signup-header">
        <div className="signup-header-logo">
          <div className="signup-header-mark">
            <GraduationCap size={24} />
          </div>
          <div className="signup-header-wordmark">AcadPulse</div>
        </div>
        <div className="signup-progress">
          <span className="signup-progress-dot signup-progress-active"></span>
          <span className="signup-progress-dot"></span>
          <span className="signup-progress-dot"></span>
        </div>
      </div>

      <div className="signup-hero">
        <h1>How would you like to join?</h1>
        <p>Choose your preferred way to get started</p>
      </div>

      <div className="signup-choice-grid">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.key}
              type="button"
              className={`signup-choice-card ${option.cardClass} ${selectedMethod === option.key ? 'selected' : ''}`}
              onClick={() => chooseMethod(option)}
            >
              <div className={`signup-choice-icon ${option.iconClass}`}>
                <Icon size={44} />
              </div>
              <h2>{option.title}</h2>
              <p>{option.subtitle}</p>
            </button>
          );
        })}
      </div>

      <div className="signup-feature-strip">
        <div className="signup-feature-chip">
          <RadioTower size={14} />
          <span>Connects everything</span>
        </div>
        <div className="signup-feature-chip">
          <BrainCircuit size={14} />
          <span>Understands Roman Urdu</span>
        </div>
        <div className="signup-feature-chip">
          <Zap size={14} />
          <span>Never miss a deadline</span>
        </div>
      </div>

      <div className="signup-footer-link">
        <span>Already have an account?</span>
        <Link to="/login" className="auth-link auth-link-strong">
          Sign in
        </Link>
      </div>
    </div>
  );
}
