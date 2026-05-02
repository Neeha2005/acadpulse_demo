import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function TaskDetailsModal({ task, onClose }) {
  const { removeTask } = useAppContext();
  const [status, setStatus] = useState('idle');

  const handleComplete = () => {
    setStatus('saving');
    console.log(`[API MOCK TETHER] PUT backend.com/api/tasks/${task.id}/complete`);
    setTimeout(() => {
        removeTask(task.id);
        setStatus('idle');
        onClose();
    }, 800);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{overflow: 'hidden'}}>
        <div className="modal-header" style={{border: 'none', paddingBottom: 0}}>
           <div style={{flex: 1}}></div>
           <button className="icon-btn" onClick={onClose} style={{zIndex: 10}}><i className="fa-solid fa-xmark"></i></button>
        </div>
        
        <div className="modal-body" style={{padding: 0, marginTop: '-24px'}}>
           <div style={{padding: '32px 32px 24px', background: 'linear-gradient(135deg, var(--surface-hover), var(--surface))', borderBottom: '1px solid var(--border)' }}>
             <div style={{display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20}}>
               <div style={{width: 56, height: 56, borderRadius: 16, background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.2)'}}>
                 <i className={`${task.source === 'manual' ? 'fa-solid fa-thumbtack' : 'fa-brands ' + task.icon}`}></i>
               </div>
               <div>
                  <h3 style={{fontSize: 22, color: 'var(--text)', margin: '0 0 6px 0', lineHeight: 1.2}}>{task.title}</h3>
                  <span className="badge" style={{background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 11, padding: '4px 10px'}}>{task.sourceLabel || "Integration Pipeline"}</span>
               </div>
             </div>
             
             <div className="modal-meta" style={{marginBottom: 0, display: 'flex', gap: 12}}>
               <span className="meta-item" style={{background: 'rgba(0,0,0,0.3)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', color: 'var(--text-muted)'}}><i className="fa-solid fa-book text-primary"></i> <strong style={{color: 'var(--text)', fontWeight: 500, marginLeft: 4}}>{task.course}</strong></span>
               {task.due && <span className="meta-item" style={{background: 'rgba(0,0,0,0.3)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', color: 'var(--text-muted)'}}><i className="fa-solid fa-clock text-urgent"></i> <strong style={{color: 'var(--text)', fontWeight: 500, marginLeft: 4}}>{task.due}</strong></span>}
             </div>
           </div>
           
           <div style={{padding: '32px'}}>
             <h4 style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600}}>Task Description parameters</h4>
             <div className="modal-content-box" style={{background: 'var(--bg)', border: '1px solid var(--border-strong)', fontSize: 14, lineHeight: 1.7, padding: 20, color: 'var(--text-muted)'}}>
                {task.content || "No detailed parameters or instructions were provided for this node."}
             </div>
           </div>
        </div>
        
        <div className="modal-footer" style={{background: 'var(--surface)', padding: '20px 32px'}}>
            <button className="btn btn-outline" onClick={onClose} style={{marginRight: 'auto'}}>Dismiss</button>
            <button className="btn btn-primary" onClick={handleComplete} disabled={status === 'saving'} style={{padding: '12px 24px', fontSize: 14}}>
                {status === 'saving' ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Finalizing Sync...</> : <><i className="fa-solid fa-check"></i> Mark as Complete</>}
            </button>
        </div>
      </div>
    </div>
  );
}
