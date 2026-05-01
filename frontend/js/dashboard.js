// dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const urgentTasksContainer = document.getElementById('urgent-tasks');
    const notificationStream = document.getElementById('notification-stream');

    const mockNotifications = [
        { id: 'n3', sender: 'CS Dept Official', source: 'whatsapp', time: '10 mins ago', title: 'Guest Lecture by Google Engineer', preview: 'There will be a guest lecture tomorrow...', content: 'There will be a guest lecture tomorrow at 2 PM in Hall A regarding modern deployment stacks.', course: 'General' },
        { id: 'n4', sender: 'Dr. Sarah (Deep Learning)', source: 'classroom', time: '2 hours ago', title: 'Slides for Lecture 10 Uploaded', preview: 'I have uploaded the slides covering CNN architectures.', content: 'I have uploaded the slides covering CNN architectures. Please review them before the lab session this Friday.', course: 'CS 502 - Deep Learning' },
        { id: 'n5', sender: 'Class Representative', source: 'whatsapp', time: '5 hours ago', title: 'Class Rescheduled', preview: 'Hey guys, tomorrow\'s morning class is moved to 4 PM.', content: 'Hey guys, tomorrow\'s morning class is moved to 4 PM. Professor informed just now.', course: 'SE 301 - Software Engineering' }
    ];

    const viewAllBtn = document.querySelector('.panel-header .text-btn');
    let isExpandedTasks = false;
    if (viewAllBtn && viewAllBtn.textContent.includes('View all')) {
        viewAllBtn.addEventListener('click', () => {
            isExpandedTasks = !isExpandedTasks;
            viewAllBtn.textContent = isExpandedTasks ? 'Show less' : 'View all';
            renderUrgentTasks();
        });
    }

    function renderUrgentTasks() {
        if(!urgentTasksContainer) return;
        urgentTasksContainer.innerHTML = '';
        
        const tasks = window.AppStore.getTasks();
        const countSpan = document.getElementById('urgent-count');
        if (countSpan) countSpan.textContent = tasks.length;
        
        // Show max 3 tasks originally unless expanded
        const displayTasks = isExpandedTasks ? tasks : tasks.slice(0, 3);

        displayTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = `task-card ${task.urgency === 'urgent' ? 'urgent' : ''}`;
            
            let colorCls = '';
            // fa-brands or fa-solid fallback fix
            let iconFormat = task.source === 'gmail' || task.source === 'manual' ? 'fa-solid' : 'fa-brands';

            if(task.source === 'whatsapp') colorCls = 'text-whatsapp';
            else if(task.source === 'classroom') colorCls = 'text-warning';
            else if(task.source === 'gmail') colorCls = 'text-urgent';
            else colorCls = 'text-primary';

            card.innerHTML = `
                <div class="task-top">
                    <span class="task-course">${task.course}</span>
                    <span class="task-due"><i class="fa-solid fa-clock"></i> ${task.due}</span>
                </div>
                <h3 class="task-title">${task.title}</h3>
                <div class="task-footer">
                    <span class="task-source ${colorCls}"><i class="${iconFormat} ${task.icon}"></i> ${task.sourceLabel}</span>
                    <button class="icon-btn complete-task-btn" style="width:28px;height:28px;font-size:12px;"><i class="fa-solid fa-check"></i></button>
                </div>
            `;
            
            // Logic to launch details modal
            card.addEventListener('click', (e) => {
                if(e.target.closest('button')) return;
                if(window.openDetailsModal) window.openDetailsModal(task);
            });
            
            // Logic mimicking Backend PUT Completion request
            const completeBtn = card.querySelector('.complete-task-btn');
            completeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                completeBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
                console.log(`[API MOCK TETHER] PUT backend.com/api/tasks/${task.id}/complete`);
                
                setTimeout(() => {
                    card.style.opacity = '0';
                    card.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        window.AppStore.removeTask(task.id);
                    }, 300);
                }, 800);
            });
            
            urgentTasksContainer.appendChild(card);
        });
    }

    function renderNotifications(filter = 'all') {
        if(!notificationStream) return;
        notificationStream.innerHTML = '';
        const filtered = filter === 'all' ? mockNotifications : mockNotifications.filter(n => n.source === filter);

        filtered.forEach(notif => {
            const item = document.createElement('div');
            item.className = 'notif-item';
            
            let iconBody = '';
            if(notif.source === 'whatsapp') iconBody = '<i class="fa-brands fa-whatsapp"></i>';
            else if(notif.source === 'classroom') iconBody = '<i class="fa-brands fa-google"></i>';
            else if(notif.source === 'gmail') iconBody = '<i class="fa-solid fa-envelope"></i>';

            item.innerHTML = `
                <div class="notif-icon-wrap ${notif.source}">
                    ${iconBody}
                </div>
                <div class="notif-content">
                    <div class="notif-header">
                        <span class="notif-sender">${notif.sender}</span>
                        <span class="notif-time">${notif.time}</span>
                    </div>
                    <h4 class="notif-title">${notif.title}</h4>
                    <p class="notif-preview">${notif.preview}</p>
                </div>
            `;
            item.addEventListener('click', () => {
                if(window.openDetailsModal) {
                    window.openDetailsModal({
                        title: notif.title, course: notif.course, content: notif.content,
                        source: notif.source, sourceLabel: notif.sender
                    }, true);
                }
            });
            notificationStream.appendChild(item);
        });
    }

    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNotifications(btn.dataset.filter);
        });
    });

    renderUrgentTasks();
    renderNotifications();

    window.addEventListener('store_updated', renderUrgentTasks);
});
