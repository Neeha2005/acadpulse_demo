import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function AccountModal({ onClose }) {
  const { user, updateUser } = useAppContext();
  const [formData, setFormData] = useState(user);
  const [status, setStatus] = useState('idle');

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('saving');
    console.log("[API MOCK TETHER] PUT backend.com/api/users/profile", formData);
    
    setTimeout(() => {
      updateUser(formData);
      setStatus('idle');
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="panel-title"><i className="fa-solid fa-user-pen text-primary"></i> Account Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <div>
              <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Full Name</label>
              <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required style={{width: '100%', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
            </div>
            <div>
              <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required style={{width: '100%', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
            </div>
            <div>
              <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>WhatsApp Number</label>
              <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{width: '100%', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
              {status === 'saving' ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
