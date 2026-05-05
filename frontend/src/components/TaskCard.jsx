import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function TaskCard({ task }) {
  const { completeTask } = useAppContext();
  const [completeState, setCompleteState] = useState('idle');
  
  const handleComplete = async (e) => {
    e.stopPropagation();
    setCompleteState('syncing');

    try {
      await completeTask(task);
      setCompleteState('fade');
    } catch (error) {
      console.error('Failed to complete task:', error);
      setCompleteState('idle');
    }
  };

  let iconFormat = task.source === 'gmail' || task.source === 'manual' ? 'fa-solid' : 'fa-brands';
  const colorCls = task.source === 'whatsapp'
    ? 'text-whatsapp'
    : task.source === 'classroom'
      ? 'text-warning'
      : task.source === 'gmail'
        ? 'text-urgent'
        : 'text-primary';

  const { setActiveTaskModal } = useAppContext();
  const urgencyLabel = (task.urgencyLabel || 'none').toLowerCase();
  const urgencyBadgeClass = urgencyLabel === 'overdue'
    ? 'badge-muted'
    : task.urgency === 'urgent'
      ? 'badge-warning'
      : task.urgency === 'warning'
        ? 'badge-warning'
        : 'badge-success';

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
        {urgencyLabel !== 'none' && <span className={`badge ${urgencyBadgeClass}`}>{urgencyLabel}</span>}
        <button className="icon-btn complete-task-btn" style={{width: 28, height: 28, fontSize: 12}} onClick={handleComplete}>
          {completeState === 'syncing' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
        </button>
      </div>
    </div>
  )
}
