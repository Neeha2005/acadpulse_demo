import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('acad_tasks_react_v3');
    if (saved) return JSON.parse(saved);
    return [
      { id: 't1', title: 'AREY HALKUU REY', course: 'KAMAR DARD', due: '1 Jan, 12:12 pm', urgency: 'urgent', source: 'manual', sourceLabel: 'Manual Task', icon: 'fa-thumbtack', content: 'Custom manually injected task requirement.' }
    ];
  });

  const [notifications, setNotifications] = useState([
    { id: 'n1', sender: 'CS Dept Official', title: 'Guest Lecture by Google Engineer', preview: 'There will be a guest lecture tomorrow...', time: '10 mins ago', source: 'whatsapp', icon: 'fa-whatsapp' },
    { id: 'n2', sender: 'Dr. Sarah (Deep Learning)', title: 'Slides for Lecture 10 Uploaded', preview: 'I have uploaded the slides covering CNN architectures.', time: '2 hours ago', source: 'classroom', icon: 'fa-google' },
    { id: 'n3', sender: 'Class Representative', title: 'Assignment 3 Deadline', preview: 'Reminder: Deadline is approaching soon.', time: '5 hours ago', source: 'whatsapp', icon: 'fa-whatsapp' }
  ]);
  
  const [user, setUser] = useState(() => {
    const savedName = localStorage.getItem('acad_user_name_react_v3');
    return {
      fullName: savedName || "Scholar",
      email: "student@university.edu",
      phone: "+1 (555) 123-4567"
    };
  });

  const removeTask = (id) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem('acad_tasks_react_v3', JSON.stringify(updated));
      return updated;
    });
  };

  const addTask = (task) => {
    setTasks(prev => {
      const updated = [task, ...prev];
      localStorage.setItem('acad_tasks_react_v3', JSON.stringify(updated));
      return updated;
    });
  };

  const updateUser = (data) => {
    setUser(prev => {
      const updated = { ...prev, ...data };
      localStorage.setItem('acad_user_name_react_v3', updated.fullName);
      return updated;
    });
  };

  const [activeTaskModal, setActiveTaskModal] = useState(null);

  return (
    <AppContext.Provider value={{ tasks, removeTask, addTask, user, updateUser, activeTaskModal, setActiveTaskModal, notifications }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
