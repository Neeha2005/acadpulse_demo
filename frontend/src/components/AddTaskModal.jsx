import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function AddTaskModal({ onClose }) {
  const { createManualTask } = useAppContext();
  const [formData, setFormData] = useState({ title: '', course: '', dueDate: '', dueTime: '', content: '' });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation Constraints
    if (!formData.dueDate || !formData.dueTime) {
      setErrorMsg('Date and time fields are mandatory.');
      return;
    }

    const selectedDateTime = new Date(`${formData.dueDate}T${formData.dueTime}`);
    if (selectedDateTime < new Date()) {
      setErrorMsg('Deadline cannot be set in the past! Please construct a future timeline.');
      return;
    }

    setErrorMsg('');
    setStatus('saving');

    try {
      await createManualTask(formData);
      setStatus('idle');
      onClose();
    } catch (error) {
      setStatus('idle');
      setErrorMsg(error.message || 'Unable to create manual task right now.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="panel-title"><i className="fa-solid fa-plus text-primary"></i> Add Manual Task</h2>
          <button type="button" className="icon-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <div>
              <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Task Title <span className="text-urgent">*</span></label>
              <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required placeholder="e.g. Write Introduction for Research Paper" style={{width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
            </div>
            
            <div style={{display: 'flex', gap: 16}}>
              <div style={{flex: 1}}>
                <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Due Date <span className="text-urgent">*</span></label>
                <input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} required style={{width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
              </div>
              <div style={{flex: 1}}>
                <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Deadline Time <span className="text-urgent">*</span></label>
                <input type="time" value={formData.dueTime} onChange={e => setFormData({...formData, dueTime: e.target.value})} required style={{width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
              </div>
            </div>

            {errorMsg && (
               <div style={{color: 'var(--urgent)', fontSize: 13, padding: '10px 12px', background: 'var(--urgent-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--urgent)'}}>
                  <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
               </div>
            )}
            
            <div>
              <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Course Code (Optional)</label>
              <input type="text" value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} placeholder="e.g. CS 401" style={{width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)'}} />
            </div>
            
            <div>
              <label style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, display: 'block'}}>Detailed Description</label>
              <textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} rows="4" placeholder="Additional parameters or instructions..." style={{width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit'}}></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={status === 'saving' || !formData.title.trim()}>
              {status === 'saving' ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Injecting...</> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
