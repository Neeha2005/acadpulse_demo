import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function TaskCard({ task }) {
  const { removeTask } = useAppContext();
  const [completeState, setCompleteState] = useState('idle');
  
  const handleComplete = (e) => {
    e.stopPropagation();
    setCompleteState('syncing');
    console.log(`[API MOCK TETHER] PUT backend.com/api/tasks/${task.id}/complete`);
    
    setTimeout(() => {
      setCompleteState('fade');
      setTimeout(() => {
        removeTask(task.id);
      }, 300);
    }, 800);
  };

  let iconFormat = task.source === 'gmail' || task.source === 'manual' ? 'fa-solid' : 'fa-brands';
  let colorCls = '';
  if(task.source === 'whatsapp') colorCls = 'text-whatsapp';
  else if(task.source === 'classroom') colorCls = 'text-warning';
  else if(task.source === 'gmail') colorCls = 'text-urgent';
  else colorCls = 'text-primary';

  const { setActiveTaskModal } = useAppContext();

  return (
    <div 
      className={`task-card ${task.urgency === 'urgent' ? 'urgent' : ''}`}
      style={{ opacity: completeState === 'fade' ? 0 : 1, transition: 'opacity 0.3s ease' }}
      onClick={(e) => {
        if(e.target.closest('button')) return;
        setActiveTaskModal(task);
      }}
    >
      <div className="task-top">
        <span className="task-course">{task.course}</span>
        <span className="task-due"><i className="fa-solid fa-clock"></i> {task.due}</span>
      </div>
      <h3 className="task-title">{task.title}</h3>
      <div className="task-footer">
        <span className={`task-source ${colorCls}`}><i className={`${iconFormat} ${task.icon}`}></i> {task.sourceLabel}</span>
        <button className="icon-btn complete-task-btn" style={{width: 28, height: 28, fontSize: 12}} onClick={handleComplete}>
          {completeState === 'syncing' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
        </button>
      </div>
    </div>
  )
}
