import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AccountModal from './AccountModal';
import TaskDetailsModal from './TaskDetailsModal';
import AddTaskModal from './AddTaskModal';
import Chatbot from '../pages/Chatbot';
import { useAppContext } from '../context/AppContext';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showSemesterReset, setShowSemesterReset] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetStatus, setResetStatus] = useState('idle');
  const [toast, setToast] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { activeTaskModal, setActiveTaskModal, apiFetch, refreshNotifications } = useAppContext();

  useEffect(() => {
    if (location.pathname === '/chat') {
      window.setTimeout(() => setShowChatbot(true), 0);
    }
  }, [location.pathname]);

  const closeChatbot = () => {
    setShowChatbot(false);
    if (location.pathname === '/chat') {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSemesterReset = async () => {
    if (resetConfirmText !== 'RESET' || resetStatus === 'saving') return;

    setResetStatus('saving');
    try {
      const payload = await apiFetch('/semester/reset', { method: 'POST' });
      setShowSemesterReset(false);
      setResetConfirmText('');
      setToast(`Semester archived! Fresh start ✨ ${payload?.archived_count ?? 0} items archived.`);
      await refreshNotifications();
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setToast('Semester reset failed. Please try again.');
    } finally {
      setResetStatus('idle');
      window.setTimeout(() => setToast(''), 4500);
    }
  };

  return (
    <>
      <Sidebar 
        onOpenAccount={() => setShowAccountModal(true)} 
        onOpenSemesterReset={() => setShowSemesterReset(true)}
        onOpenChatbot={() => {
          setShowChatbot(true);
          navigate('/chat');
        }}
        chatbotOpen={showChatbot}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="main-content">
        <Topbar onOpenAddTask={() => setShowAddTaskModal(true)} />
        <div key={location.key} className="page-transition">
          <Outlet />
        </div>
      </div>
      {showAccountModal && <AccountModal onClose={() => setShowAccountModal(false)} />}
      {showAddTaskModal && <AddTaskModal onClose={() => setShowAddTaskModal(false)} />}
      <Chatbot open={showChatbot} onClose={closeChatbot} />
      {showSemesterReset && (
        <div className="modal-overlay">
          <div className="modal-container semester-reset-modal">
            <div className="modal-header">
              <div className="semester-reset-heading">
                <div className="semester-warning-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                <h2 className="panel-title">Start a New Semester?</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowSemesterReset(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body">
              <p className="semester-reset-copy">
                All current notifications will be archived. Your timetable and course mappings will be reset. This cannot be undone.
              </p>
              <label className="semester-reset-label">
                Type RESET to confirm
                <input
                  value={resetConfirmText}
                  onChange={(event) => setResetConfirmText(event.target.value)}
                  placeholder="RESET"
                />
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowSemesterReset(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn semester-reset-danger"
                disabled={resetConfirmText !== 'RESET' || resetStatus === 'saving'}
                onClick={handleSemesterReset}
              >
                {resetStatus === 'saving' ? 'Archiving...' : 'Archive & Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="app-toast">{toast}</div>}
      {activeTaskModal && <TaskDetailsModal task={activeTaskModal} onClose={() => setActiveTaskModal(null)} />}
    </>
  );
}
