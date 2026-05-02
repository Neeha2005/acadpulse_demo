import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AccountModal from './AccountModal';
import TaskDetailsModal from './TaskDetailsModal';
import AddTaskModal from './AddTaskModal';
import { useAppContext } from '../context/AppContext';

export default function Layout() {
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { activeTaskModal, setActiveTaskModal } = useAppContext();

  return (
    <>
      <Sidebar 
        onOpenAccount={() => setShowAccountModal(true)} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="main-content">
        <Topbar onOpenAddTask={() => setShowAddTaskModal(true)} />
        <Outlet />
      </div>
      {showAccountModal && <AccountModal onClose={() => setShowAccountModal(false)} />}
      {showAddTaskModal && <AddTaskModal onClose={() => setShowAddTaskModal(false)} />}
      {activeTaskModal && <TaskDetailsModal task={activeTaskModal} onClose={() => setActiveTaskModal(null)} />}
    </>
  );
}
