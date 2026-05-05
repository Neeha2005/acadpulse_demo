import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Mail, Phone, School, TriangleAlert, User } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { useAppContext } from '../context/AppContext';

export default function Signup() {
  const navigate = useNavigate();
  const { register } = useAppContext();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    university: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.university.trim() || form.password.length < 8) {
      setFormError('Name, phone, university, and an 8 character password are required.');
      return;
    }

    try {
      setLoading(true);
      await register({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        university: form.university.trim(),
        password: form.password,
      });
      localStorage.removeItem('acadpulse_onboarding_complete');
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(error?.payload?.detail || error?.message || 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-card auth-signin-card auth-card-enter">
        {formError && (
          <div className="auth-banner auth-banner-danger auth-banner-fade">
            <TriangleAlert size={16} />
            <span>{formError}</span>
          </div>
        )}

        <div className="auth-card-header">
          <span className="auth-kicker">New account</span>
          <h2>Create AcadPulse account</h2>
          <p>Use your own phone number and university details.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field-group">
            <label htmlFor="signup-name">Full name</label>
            <div className="auth-input-wrap">
              <User size={16} />
              <input id="signup-name" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Areeba Khan" />
            </div>
          </div>

          <div className="auth-field-group">
            <label htmlFor="signup-phone">Phone number</label>
            <div className="auth-input-wrap">
              <Phone size={16} />
              <input id="signup-phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+92 300 1234567" />
            </div>
          </div>

          <div className="auth-field-group">
            <label htmlFor="signup-email">Email address <span style={{ color: 'var(--text-muted)' }}>optional</span></label>
            <div className="auth-input-wrap">
              <Mail size={16} />
              <input id="signup-email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="student@university.edu" />
            </div>
          </div>

          <div className="auth-field-group">
            <label htmlFor="signup-university">University</label>
            <div className="auth-input-wrap">
              <School size={16} />
              <input id="signup-university" value={form.university} onChange={(event) => updateField('university', event.target.value)} placeholder="FAST, LUMS, COMSATS..." />
            </div>
          </div>

          <div className="auth-field-group">
            <label htmlFor="signup-password">Password</label>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input id="signup-password" type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder="At least 8 characters" />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <span className="auth-spinner"></span> : 'Create account'}
          </button>
        </form>

        <div className="auth-card-footer">
          <GraduationCap size={16} />
          <span>Already have an account?</span>
          <Link to="/login" className="auth-link auth-link-strong auth-link-arrow">
            {'Sign in ->'}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
