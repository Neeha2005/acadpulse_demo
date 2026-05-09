import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAppContext } from './context/AppContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AssignmentsQuizzes from './pages/AssignmentsQuizzes'
import Events from './pages/Events'
import Announcements from './pages/Announcements'
import Materials from './pages/Materials'
import Timetable from './pages/Timetable'
import Courses from './pages/Courses'
import Onboarding from './pages/Onboarding'
import Integrations from './pages/Integrations'
import WhatsAppIntegration from './pages/WhatsAppIntegration'
import ClassroomIntegration from './pages/ClassroomIntegration'
import GmailIntegration from './pages/GmailIntegration'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SignupGoogle from './pages/SignupGoogle'
import SignupWhatsApp from './pages/SignupWhatsApp'

const PREVIEW_BYPASS_AUTH = false

function RequireAuth({ children }) {
  const { authReady, isAuthenticated } = useAppContext()

  if (PREVIEW_BYPASS_AUTH) {
    return children
  }

  if (!authReady) {
    return <div className="dashboard-scroll"></div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function DashboardGate({ children }) {
  const { apiFetch, authReady, isAuthenticated, authUser } = useAppContext()
  const [status, setStatus] = useState('checking')
  const [completed, setCompleted] = useState(false)

  if (PREVIEW_BYPASS_AUTH) {
    return children
  }

  useEffect(() => {
    if (!authReady || !isAuthenticated) {
      return
    }

    let mounted = true

    const query = authUser?.id ? `?user_id=${encodeURIComponent(authUser.id)}` : ''
    apiFetch(`/onboarding/status${query}`, {}, false)
      .then((payload) => {
        if (!mounted) return
        setCompleted(Boolean(payload?.completed))
        setStatus('ready')
      })
      .catch(() => {
        if (!mounted) return
        setCompleted(localStorage.getItem('acadpulse_onboarding_complete') === 'true')
        setStatus('ready')
      })

    return () => {
      mounted = false
    }
  }, [apiFetch, authReady, isAuthenticated, authUser?.id])

  if (!authReady) {
    return <div className="dashboard-scroll"></div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (status === 'checking') {
    return <div className="dashboard-scroll"></div>
  }

  if (!completed) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/google" element={<SignupGoogle />} />
      <Route path="/signup/whatsapp" element={<SignupWhatsApp />} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardGate><Dashboard /></DashboardGate>} />
        <Route path="/assignments" element={<RequireAuth><AssignmentsQuizzes /></RequireAuth>} />
        <Route path="/events" element={<RequireAuth><Events /></RequireAuth>} />
        <Route path="/announcements" element={<RequireAuth><Announcements /></RequireAuth>} />
        <Route path="/materials" element={<RequireAuth><Materials /></RequireAuth>} />
        <Route path="/timetable" element={<RequireAuth><Timetable /></RequireAuth>} />
        <Route path="/courses" element={<RequireAuth><Courses /></RequireAuth>} />
        <Route path="/chat" element={<Navigate to="/dashboard" replace />} />
        <Route path="/chatbot" element={<Navigate to="/dashboard" replace />} />
        <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
        <Route path="/integrations/whatsapp" element={<RequireAuth><WhatsAppIntegration /></RequireAuth>} />
        <Route path="/integrations/classroom" element={<RequireAuth><ClassroomIntegration /></RequireAuth>} />
        <Route path="/integrations/gmail" element={<RequireAuth><GmailIntegration /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App