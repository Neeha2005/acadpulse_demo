import { ArrowLeft, BookOpen, Building2, CheckCircle2, Globe, GraduationCap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'

const semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export default function SignupGoogle() {
  const navigate = useNavigate()
  const [step, setStep] = useState('oauth')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    university: '',
    degree: '',
    semester: '1st',
  })

  const handleGoogleStart = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep('profile')
    }, 1000)
  }

  const completeSetup = (event) => {
    event.preventDefault()
    setStep('success')
    setTimeout(() => {
      navigate('/login', {
        replace: true,
        state: { signupSuccess: 'Account created! Welcome to AcadPulse.' },
      })
    }, 1500)
  }

  return (
    <div className="signup-onboarding signup-flow-screen">
      <div className="signup-floating-orb orb-a"></div>
      <div className="signup-floating-orb orb-b"></div>
      <div className="signup-floating-orb orb-c"></div>

      <div className="signup-header signup-header-compact">
        <div className="signup-header-logo">
          <div className="signup-header-mark">
            <GraduationCap size={22} />
          </div>
          <div className="signup-header-wordmark">AcadPulse</div>
        </div>
        <div className="signup-header-controls">
          <Link to="/signup" className="signup-back-link">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <div className="signup-progress">
            <span className="signup-progress-dot"></span>
            <span className="signup-progress-dot signup-progress-active"></span>
            <span
              className={`signup-progress-dot ${
                step === 'success' || step === 'profile' ? 'signup-progress-active-final' : ''
              }`}
            ></span>
          </div>
        </div>
      </div>

      <div className={`signup-flow-card ${step === 'success' ? 'signup-success-card' : ''}`}>
        {step === 'oauth' && (
          <div className="signup-step-pane signup-step-enter">
            <div className="signup-flow-icon signup-flow-google">
              <Globe size={42} />
            </div>
            <h1>Setting up with Google</h1>
            <p>We'll link your Gmail and Google Classroom automatically.</p>

            <button
              type="button"
              className="signup-google-oauth-btn"
              onClick={handleGoogleStart}
              disabled={loading}
            >
              <span className="auth-google-mark" aria-hidden="true">
                <span className="auth-google-g">G</span>
              </span>
              <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>

            <div className="auth-divider">
              <span>secure setup</span>
            </div>
            <p className="signup-trust-copy">
              This gives AcadPulse read-only access to your Gmail and Classroom.
            </p>
          </div>
        )}

        {step === 'profile' && (
          <form className="signup-step-pane signup-step-enter" onSubmit={completeSetup}>
            <div className="signup-flow-icon signup-flow-gold">
              <Building2 size={40} />
            </div>
            <h1>Almost there! Complete your profile</h1>
            <p>Finish your setup so the dashboard feels tailored from day one.</p>

            <div className="auth-form signup-profile-form">
              <div className="auth-field-group">
                <label htmlFor="google-university">University name</label>
                <div className="auth-input-wrap">
                  <Building2 size={16} />
                  <input
                    id="google-university"
                    type="text"
                    placeholder="e.g. FAST, LUMS, COMSATS"
                    value={form.university}
                    onChange={(event) => setForm((prev) => ({ ...prev, university: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="google-degree">Degree program</label>
                <div className="auth-input-wrap">
                  <BookOpen size={16} />
                  <input
                    id="google-degree"
                    type="text"
                    placeholder="e.g. BS Computer Science"
                    value={form.degree}
                    onChange={(event) => setForm((prev) => ({ ...prev, degree: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="google-semester">Semester</label>
                <div className="auth-input-wrap auth-select-wrap">
                  <BookOpen size={16} />
                  <select
                    id="google-semester"
                    value={form.semester}
                    onChange={(event) => setForm((prev) => ({ ...prev, semester: event.target.value }))}
                  >
                    {semesters.map((semester) => (
                      <option key={semester} value={semester}>
                        {semester}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="auth-submit-btn">
                Complete Setup
              </button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="signup-step-pane signup-success-pane">
            <div className="signup-success-mark">
              <CheckCircle2 size={54} />
            </div>
            <h1>Welcome to AcadPulse</h1>
            <p>Finishing the last details and sending you back to sign in.</p>
          </div>
        )}
      </div>
    </div>
  )
}
