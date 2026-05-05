import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, GraduationCap, Lock, Mail, Phone, School, TriangleAlert, User } from 'lucide-react';
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
  const [success, setSuccess] = useState(false);
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
      setSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, 750));
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
            <div className="auth-input-wrap auth-float-wrap">
              <User size={16} className="auth-field-icon" />
              <input
                id="signup-name"
                type="text"
                placeholder=" "
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
              <label htmlFor="signup-name" className="auth-float-label">Full name</label>
            </div>
          </div>

          <div className="auth-field-group">
            <div className="auth-input-wrap auth-float-wrap">
              <Phone size={16} className="auth-field-icon" />
              <input
                id="signup-phone"
                type="text"
                placeholder=" "
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
              <label htmlFor="signup-phone" className="auth-float-label">Phone number</label>
            </div>
          </div>

          <div className="auth-field-group">
            <div className="auth-input-wrap auth-float-wrap">
              <Mail size={16} className="auth-field-icon" />
              <input
                id="signup-email"
                type="email"
                placeholder=" "
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
              <label htmlFor="signup-email" className="auth-float-label">
                Email address <em style={{ fontStyle: 'normal', color: 'var(--text-faint)', fontWeight: 400 }}>optional</em>
              </label>
            </div>
          </div>

          <div className="auth-field-group">
            <div className="auth-input-wrap auth-float-wrap">
              <School size={16} className="auth-field-icon" />
              <input
                id="signup-university"
                type="text"
                placeholder=" "
                value={form.university}
                onChange={(event) => updateField('university', event.target.value)}
              />
              <label htmlFor="signup-university" className="auth-float-label">University</label>
            </div>
          </div>

          <div className="auth-field-group">
            <div className="auth-input-wrap auth-float-wrap">
              <Lock size={16} className="auth-field-icon" />
              <input
                id="signup-password"
                type="password"
                placeholder=" "
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
              />
              <label htmlFor="signup-password" className="auth-float-label">Password (min. 8 characters)</label>
            </div>
          </div>

          <button
            type="submit"
            className={`auth-submit-btn ${success ? 'auth-submit-success' : ''}`}
            disabled={loading || success}
          >
            {loading
              ? <span className="auth-spinner"></span>
              : success
                ? <Check size={20} strokeWidth={2.5} />
                : 'Create account'}
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
