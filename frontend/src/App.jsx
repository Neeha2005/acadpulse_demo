import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Timetable from './pages/Timetable'
import Courses from './pages/Courses'
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
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/courses" element={<Courses />} />
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
