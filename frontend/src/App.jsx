import { Navigate, Route, Routes } from 'react-router-dom'
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/google" element={<SignupGoogle />} />
      <Route path="/signup/whatsapp" element={<SignupWhatsApp />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assignments" element={<AssignmentsQuizzes />} />
        <Route path="/events" element={<Events />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/chatbot" element={<Navigate to="/dashboard" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/integrations/whatsapp" element={<WhatsAppIntegration />} />
        <Route path="/integrations/classroom" element={<ClassroomIntegration />} />
        <Route path="/integrations/gmail" element={<GmailIntegration />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
