import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const ONBOARDING_STORAGE_KEYS = [
  'acadpulse_onboarding_draft_v2',
  'acadpulse_onboarding_step_v1',
  'acadpulse_onboarding_complete',
  'acadpulse_university',
  'acadpulse_degree',
  'acadpulse_semester',
  'acadpulse_section',
  'acadpulse_gmail_connected',
  'acadpulse_classroom_connected',
]

export default function AccountModal({ onClose }) {
  const { user, updateUser, apiFetch, logout } = useAppContext();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(user);
  const [status, setStatus] = useState('idle');
  const [deleteStatus, setDeleteStatus] = useState('idle');
  const [deleteError, setDeleteError] = useState('');

  const initials = useMemo(
    () => (formData.fullName ? formData.fullName.substring(0, 2).toUpperCase() : 'SC'),
    [formData.fullName],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('saving');
    console.log('[API MOCK TETHER] PUT backend.com/api/users/profile', formData);

    setTimeout(() => {
      updateUser(formData);
      setStatus('idle');
      onClose();
    }, 1000);
  };

  const handleOpenSetup = () => {
    onClose();
    navigate('/onboarding');
  };

  const handleDeleteProfile = async () => {
    if (deleteStatus === 'saving') return
    const confirmed = window.confirm('Delete your AcadPulse profile and all saved onboarding data? This cannot be undone.')
    if (!confirmed) return

    setDeleteStatus('saving')
    setDeleteError('')
    try {
      await apiFetch('/auth/profile', { method: 'DELETE' })
      ONBOARDING_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
      logout()
      onClose()
      navigate('/login', { replace: true })
    } catch (error) {
      setDeleteError(error?.message || 'Could not delete profile')
      setDeleteStatus('idle')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container account-modal">
        <div className="modal-header account-modal-header">
          <div className="account-modal-heading">
            <div className="account-modal-icon"><i className="fa-solid fa-user-pen"></i></div>
            <div>
              <h2 className="panel-title">Student Settings</h2>
              <p className="account-modal-subtitle">Update your profile details used across the dashboard and integrations.</p>
            </div>
          </div>
          <button type="button" className="icon-btn glass-icon-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body account-modal-body">
            <section className="account-modal-card account-modal-summary">
              <div className="account-summary-avatar">{initials}</div>
              <div className="account-summary-copy">
                <strong>{formData.fullName || 'Scholar'}</strong>
                <span>{formData.university || 'Student'}</span>
                <small>{formData.email || 'student@university.edu'}</small>
              </div>
              <div className="account-summary-badge">Live Profile</div>
            </section>

            <section className="account-modal-card">
              <div className="account-section-head">
                <span className="account-section-kicker">Profile</span>
                <h3>Student Information</h3>
              </div>

              <div className="account-form-grid">
                <label className="account-field">
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </label>

                <label className="account-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </label>

                <label className="account-field">
                  <span>WhatsApp Number</span>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+92 3XX XXXXXXX"
                  />
                </label>

                <label className="account-field">
                  <span>University</span>
                  <input
                    type="text"
                    value={formData.university || ''}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                    placeholder="e.g. FAST, LUMS, COMSATS"
                  />
                </label>
              </div>
            </section>

            <section className="account-modal-card account-setup-card">
              <div className="account-section-head">
                <span className="account-section-kicker">Academic Setup</span>
                <h3>Review onboarding details</h3>
              </div>
              <p className="account-setup-copy">
                Revisit your initial academic setup to adjust courses, semester flow, and connected-study preferences.
              </p>
              <button type="button" className="btn btn-outline account-setup-action" onClick={handleOpenSetup}>
                <i className="fa-solid fa-compass"></i> Open Academic Setup
              </button>
            </section>

            <section className="account-modal-card account-danger-card">
              <div className="account-section-head">
                <span className="account-section-kicker">Danger Zone</span>
                <h3>Delete profile</h3>
              </div>
              <p className="account-danger-copy">
                This removes your AcadPulse account and saved onboarding data. This action cannot be undone.
              </p>
              {deleteError && <div className="account-danger-error">{deleteError}</div>}
              <button
                type="button"
                className="btn account-danger-action"
                onClick={handleDeleteProfile}
                disabled={deleteStatus === 'saving'}
              >
                {deleteStatus === 'saving'
                  ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Deleting...</>
                  : <><i className="fa-solid fa-trash"></i> Delete Profile</>}
              </button>
            </section>
          </div>

          <div className="modal-footer account-modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
              {status === 'saving' ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Updating...</> : <><i className="fa-solid fa-floppy-disk"></i> Update Profile</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
