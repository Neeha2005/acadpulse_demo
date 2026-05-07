import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, GraduationCap, Lock, Mail, Phone, School, TriangleAlert, User } from 'lucide-react';
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Full name is required';
    if (!form.phone.trim()) nextErrors.phone = 'Phone number is required';
    if (!form.university.trim()) nextErrors.university = 'University is required';
    if (form.password.length < 8) nextErrors.password = 'Password must be at least 8 characters';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      setFormError('Complete the required fields to create your account.');
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
      <div className="auth-card auth-signin-card auth-signup-card auth-card-enter">
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
          <div className="auth-signup-grid">
            <div className="auth-field-group wide">
              <div className={`auth-input-wrap auth-float-wrap ${fieldErrors.name ? 'has-error' : ''}`}>
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
              {fieldErrors.name && <div className="auth-inline-error"><TriangleAlert size={14} /><span>{fieldErrors.name}</span></div>}
            </div>

            <div className="auth-field-group">
              <div className={`auth-input-wrap auth-float-wrap ${fieldErrors.phone ? 'has-error' : ''}`}>
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
              {fieldErrors.phone && <div className="auth-inline-error"><TriangleAlert size={14} /><span>{fieldErrors.phone}</span></div>}
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
                  Email address <span className="auth-label-helper">optional</span>
                </label>
              </div>
            </div>

            <div className="auth-field-group">
              <div className={`auth-input-wrap auth-float-wrap ${fieldErrors.university ? 'has-error' : ''}`}>
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
              {fieldErrors.university && <div className="auth-inline-error"><TriangleAlert size={14} /><span>{fieldErrors.university}</span></div>}
            </div>

            <div className="auth-field-group">
              <div className={`auth-input-wrap auth-float-wrap ${fieldErrors.password ? 'has-error' : ''}`}>
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder=" "
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                />
                <label htmlFor="signup-password" className="auth-float-label">Password (min. 8 characters)</label>
                <button
                  type="button"
                  className="auth-input-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <div className="auth-inline-error"><TriangleAlert size={14} /><span>{fieldErrors.password}</span></div>}
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
