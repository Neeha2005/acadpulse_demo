import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, Lock, Mail, TriangleAlert, WifiOff } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { useAppContext } from '../context/AppContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { apiFetch, login, authUser, completeLoginSession } = useAppContext()
  const oauthParams = useMemo(() => new URLSearchParams(location.search), [location.search])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [shake, setShake] = useState(false)
  const [networkError, setNetworkError] = useState('')
  const [formError, setFormError] = useState(() => oauthParams.get('oauth_error') || '')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})

  const successMessage = useMemo(
    () => location.state?.signupSuccess || '',
    [location.state],
  )

  useEffect(() => {
    const oauthToken = oauthParams.get('oauth_token')

    if (oauthToken) {
      const oauthName = oauthParams.get('oauth_name') || 'Google User'
      const oauthEmail = oauthParams.get('oauth_email') || ''
      const returnTo = oauthParams.get('return_to') || ''
      const googleConnected = oauthParams.get('google_connected') === '1'
      const googleIntegration = oauthParams.get('google_integration') || ''
      completeLoginSession(oauthToken, {
        name: oauthName,
        fullName: oauthName,
        email: oauthEmail,
      })
      if (returnTo) {
        const params = new URLSearchParams()
        if (googleConnected) params.set('google_connected', '1')
        if (googleIntegration) params.set('google_integration', googleIntegration)
        const normalizedReturnTo = returnTo.startsWith('/') ? returnTo : `/${returnTo}`
        navigate(`${normalizedReturnTo}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true })
      } else {
        navigate('/onboarding', { replace: true })
      }
    }
  }, [completeLoginSession, navigate, oauthParams])

  useEffect(() => {
    const syncStatus = () => {
      if (navigator.onLine) {
        setNetworkError('')
      }
    }

    window.addEventListener('online', syncStatus)
    return () => window.removeEventListener('online', syncStatus)
  }, [])

  const triggerShake = () => {
    setShake(false)
    window.requestAnimationFrame(() => setShake(true))
  }

  const validate = () => {
    const nextErrors = {}

    if (!email.trim()) nextErrors.email = 'Phone or email is required'
    if (!password.trim()) nextErrors.password = 'Password is required'

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    if (!navigator.onLine) {
      setNetworkError('Cannot reach server - make sure the backend is running')
      triggerShake()
      return
    }

    if (!validate()) {
      setFailedAttempts((prev) => prev + 1)
      triggerShake()
      return
    }

    try {
      setLoading(true)
      await login(email.trim(), password)
      const storedUserId = localStorage.getItem('acadpulse_user_id') || authUser?.id || ''
      const query = storedUserId ? `?user_id=${encodeURIComponent(storedUserId)}` : ''
      const payload = await apiFetch(`/onboarding/status${query}`, {}, false)
      setSuccess(true)
      await new Promise((resolve) => window.setTimeout(resolve, 750))
      navigate(payload?.completed ? '/dashboard' : '/onboarding')
    } catch (error) {
      setFormError(error?.payload?.detail || error?.message || 'Unable to sign in')
      setFailedAttempts((prev) => prev + 1)
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div
        className={`auth-card auth-signin-card auth-card-enter ${shake ? 'auth-card-shake' : ''}`}
        onAnimationEnd={() => setShake(false)}
      >
        {(networkError || formError || successMessage || failedAttempts >= 3) && (
          <div className="auth-banner-stack">
            {networkError && (
              <div className="auth-banner auth-banner-danger">
                <WifiOff size={16} />
                <span>{networkError}</span>
              </div>
            )}
            {successMessage && (
              <div className="auth-banner auth-banner-success">
                <span>{successMessage}</span>
              </div>
            )}
            {formError && (
              <div className="auth-banner auth-banner-danger auth-banner-fade">
                <TriangleAlert size={16} />
                <span>{formError}</span>
              </div>
            )}
            {failedAttempts >= 3 && (
              <div className="auth-banner auth-banner-warning auth-banner-fade">
                <TriangleAlert size={16} />
                <span>Multiple failed attempts - please check your credentials</span>
              </div>
            )}
          </div>
        )}

        <div className="auth-card-header">
          <span className="auth-kicker">Welcome back</span>
          <h2>Sign in to AcadPulse</h2>
          <p>Enter your credentials to access your dashboard</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field-group">
            <div className={`auth-input-wrap auth-float-wrap ${fieldErrors.email ? 'has-error' : ''}`}>
              <Mail size={16} className="auth-field-icon" />
              <input
                id="login-email"
                type="text"
                placeholder=" "
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, email: '' }))
                }}
              />
              <label htmlFor="login-email" className="auth-float-label">Phone or email</label>
            </div>
            {fieldErrors.email && (
              <div className="auth-inline-error auth-banner-fade">
                <TriangleAlert size={14} />
                <span>{fieldErrors.email}</span>
              </div>
            )}
          </div>

          <div className="auth-field-group">
            <div className={`auth-input-wrap auth-float-wrap ${fieldErrors.password ? 'has-error' : ''}`}>
              <Lock size={16} className="auth-field-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder=" "
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, password: '' }))
                }}
              />
              <label htmlFor="login-password" className="auth-float-label">Password</label>
              <button
                type="button"
                className="auth-input-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <div className="auth-inline-error auth-banner-fade">
                <TriangleAlert size={14} />
                <span>{fieldErrors.password}</span>
              </div>
            )}
          </div>

          <div className="auth-meta-row">
            <button type="button" className="auth-link auth-inline-button">
              Forgot password?
            </button>
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
                : 'Sign In'}
          </button>
        </form>

        <div className="auth-card-footer">
          <span>Don't have an account?</span>
          <Link to="/signup" className="auth-link auth-link-strong auth-link-arrow">
            {'Create one ->'}
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
