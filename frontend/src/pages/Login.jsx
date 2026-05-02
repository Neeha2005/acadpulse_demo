import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [status, setStatus] = useState('idle');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setStatus('loading');
    setTimeout(() => {
       navigate('/');
    }, 1500);
  };

  return (
    <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)'}}>
      <div className="panel" style={{width: 400}}>
        <div className="panel-header" style={{justifyContent: 'center'}}>
            <div className="logo" style={{fontSize: 24, justifyContent: 'center'}}><i className="fa-solid fa-graduation-cap logo-icon"></i> <span>AcadPulse</span></div>
        </div>
        <form onSubmit={handleLogin} style={{padding: 32, display: 'flex', flexDirection: 'column', gap: 20}}>
          <div>
            <label style={{color: 'var(--text-muted)', fontSize: 13}}>University Email or ID</label>
            <input type="text" required style={{width: '100%', padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', marginTop: 6}} />
          </div>
          <div>
            <label style={{color: 'var(--text-muted)', fontSize: 13}}>Password</label>
            <input type="password" required style={{width: '100%', padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text)', borderRadius: 'var(--radius-sm)', marginTop: 6}} />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{justifyContent: 'center', padding: 14, marginTop: 12}}>
            {status === 'loading' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
