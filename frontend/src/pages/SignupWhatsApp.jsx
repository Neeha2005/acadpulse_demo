import { ArrowLeft, BookOpen, Building2, CheckCircle2, GraduationCap, Phone, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'

const semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export default function SignupWhatsApp() {
  const navigate = useNavigate()
  const { register, login } = useAppContext()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [verifying, setVerifying] = useState(false)
  const [successSent, setSuccessSent] = useState(false)
  const [profile, setProfile] = useState({
    university: '',
    degree: '',
    semester: '1st',
  })
  const otpRefs = useRef([])

  useEffect(() => {
    if (countdown <= 0) return undefined

    const timer = window.setTimeout(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [countdown])

  const maskedPhone = useMemo(() => `+92 ${phone || '3XX XXXXXXX'}`, [phone])

  const sendCode = async () => {
    setSendingCode(true)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setSendingCode(false)
    setSuccessSent(true)
    setStep('otp')
    setCountdown(30)
    window.setTimeout(() => otpRefs.current[0]?.focus(), 60)
  }

  const updateOtpDigit = (index, value) => {
    const sanitized = value.replace(/\D/g, '').slice(-1)
    const nextDigits = [...otpDigits]
    nextDigits[index] = sanitized
    setOtpDigits(nextDigits)

    if (sanitized && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (!pasted) return

    event.preventDefault()
    const nextDigits = [...otpDigits]

    pasted.split('').forEach((digit, index) => {
      nextDigits[index] = digit
    })

    setOtpDigits(nextDigits)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const verifyOtp = async () => {
    setVerifying(true)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setVerifying(false)
    setStep('profile')
  }

  const completeSetup = async (event) => {
    event.preventDefault()
    const normalizedPhone = phone.replace(/\D/g, '') || '3000000000'
    const email = `whatsapp-${normalizedPhone}@acadpulse.local`
    const password = 'AcadPulse@12345'
    setStep('success')
    try {
      await register('WhatsApp Student', email, password)
    } catch {
      // Demo signup may already exist; login below handles the existing account.
    }
    try {
      await login(email, password)
      await new Promise((resolve) => setTimeout(resolve, 700))
      navigate('/onboarding', {
        replace: true,
        state: { firstRun: true },
      })
    } catch {
      navigate('/login', {
        replace: true,
        state: { signupSuccess: 'Account is ready. Please sign in.' },
      })
    }
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
                step === 'profile' || step === 'success' ? 'signup-progress-active-final' : ''
              }`}
            ></span>
          </div>
        </div>
      </div>

      <div className={`signup-flow-card ${step === 'success' ? 'signup-success-card' : ''}`}>
        {step === 'phone' && (
          <div className="signup-step-pane signup-step-enter">
            <div className="signup-flow-icon signup-flow-whatsapp">
              <Phone size={40} />
            </div>
            <h1>Verify with WhatsApp</h1>
            <p>We'll send a verification code to your WhatsApp number.</p>

            <div className="auth-form signup-profile-form">
              <div className="auth-field-group">
                <label htmlFor="wa-phone">Phone number</label>
                <div className="auth-input-wrap auth-phone-wrap">
                  <span className="auth-phone-prefix">+92</span>
                  <input
                    id="wa-phone"
                    type="text"
                    placeholder="3XX XXXXXXX"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                className={`auth-submit-btn ${successSent ? 'auth-submit-success' : ''}`}
                onClick={sendCode}
                disabled={sendingCode || !phone.trim()}
              >
                {sendingCode ? (
                  <span className="auth-spinner"></span>
                ) : successSent ? (
                  'Code sent!'
                ) : (
                  'Send Code'
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className="signup-step-pane signup-step-enter">
            <div className="signup-flow-icon signup-flow-whatsapp">
              <ShieldCheck size={40} />
            </div>
            <h1>Enter the 6-digit code</h1>
            <p>Enter the code sent to {maskedPhone}</p>

            <div className="otp-grid" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpRefs.current[index] = element
                  }}
                  className={`otp-box ${digit ? 'filled' : ''}`}
                  value={digit}
                  onChange={(event) => updateOtpDigit(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  inputMode="numeric"
                  maxLength={1}
                />
              ))}
            </div>

            <button
              type="button"
              className="auth-submit-btn"
              disabled={otpDigits.some((digit) => !digit) || verifying}
              onClick={verifyOtp}
            >
              {verifying ? <span className="auth-spinner"></span> : 'Verify & Continue'}
            </button>

            <div className="otp-resend-row">
              {countdown > 0 ? (
                <span>Resend in 0:{String(countdown).padStart(2, '0')}</span>
              ) : (
                <button type="button" className="auth-link auth-inline-button" onClick={sendCode}>
                  {'Resend code ->'}
                </button>
              )}
            </div>
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
                <label htmlFor="wa-university">University name</label>
                <div className="auth-input-wrap">
                  <Building2 size={16} />
                  <input
                    id="wa-university"
                    type="text"
                    placeholder="e.g. FAST, LUMS, COMSATS"
                    value={profile.university}
                    onChange={(event) => setProfile((prev) => ({ ...prev, university: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="wa-degree">Degree program</label>
                <div className="auth-input-wrap">
                  <BookOpen size={16} />
                  <input
                    id="wa-degree"
                    type="text"
                    placeholder="e.g. BS Computer Science"
                    value={profile.degree}
                    onChange={(event) => setProfile((prev) => ({ ...prev, degree: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label htmlFor="wa-semester">Semester</label>
                <div className="auth-input-wrap auth-select-wrap">
                  <BookOpen size={16} />
                  <select
                    id="wa-semester"
                    value={profile.semester}
                    onChange={(event) => setProfile((prev) => ({ ...prev, semester: event.target.value }))}
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
