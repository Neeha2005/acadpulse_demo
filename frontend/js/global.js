// global.js
document.addEventListener('DOMContentLoaded', () => {

    // Setup Mock Data in LocalStorage
    const defaultTasks = [
        { id: 'n1', course: 'CS 401 - Artificial Intelligence', title: 'Assignment 2: Neural Networks', due: 'Tomorrow, 11:59 PM', source: 'classroom', sourceLabel: 'Google Classroom', icon: 'fa-google', urgency: 'urgent', content: "Please submit your completed Jupyter notebooks." },
        { id: 'n2', course: 'MTH 302 - Linear Algebra', title: 'Final Project Topic', due: 'In 2 Days, 5:00 PM', source: 'gmail', sourceLabel: 'Prof. Ahmad via Gmail', icon: 'fa-envelope', urgency: 'high', content: "Email me your final project topics." }
    ];

    if (!localStorage.getItem('acad_tasks')) {
        localStorage.setItem('acad_tasks', JSON.stringify(defaultTasks));
    }

    window.AppStore = {
        getTasks: () => JSON.parse(localStorage.getItem('acad_tasks')),
        addTask: (task) => {
            const tasks = window.AppStore.getTasks();
            tasks.unshift(task);
            localStorage.setItem('acad_tasks', JSON.stringify(tasks));
            window.dispatchEvent(new Event('store_updated'));
        },
        removeTask: (id) => {
            const tasks = window.AppStore.getTasks().filter(t => t.id !== id);
            localStorage.setItem('acad_tasks', JSON.stringify(tasks));
            window.dispatchEvent(new Event('store_updated'));
            
            // Dynamic count syncing across UI
            const count = document.getElementById('urgent-count');
            if(count) count.textContent = tasks.length;
        }
    };

    // Active Sidebar Nav
    const path = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (path === 'index.html' && nav.id === 'nav-dashboard') nav.classList.add('active');
        else if (path === 'timetable.html' && nav.id === 'nav-timetable') nav.classList.add('active');
        else if (path === 'courses.html' && nav.id === 'nav-courses') nav.classList.add('active');
        else if (path === '' && nav.id === 'nav-dashboard') nav.classList.add('active');
    });

    // Add Manual Task Logic
    const btnOpenAddTask = document.getElementById('btn-open-add-task');
    const addTaskModal = document.getElementById('add-task-modal');
    const addTaskForm = document.getElementById('add-task-form');
    const closeAddModalBtns = document.querySelectorAll('.close-add-modal');

    function openAddModal() { if(addTaskModal) addTaskModal.style.display = 'flex'; }
    function closeAddModal() {
        if(!addTaskModal) return;
        addTaskModal.style.opacity = '0';
        setTimeout(() => { 
            addTaskModal.style.display = 'none'; 
            addTaskModal.style.opacity = '1'; 
            if(addTaskForm) addTaskForm.reset(); 
        }, 300);
    }

    if (btnOpenAddTask) btnOpenAddTask.addEventListener('click', openAddModal);
    closeAddModalBtns.forEach(btn => btn.addEventListener('click', closeAddModal));
    
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            let dtInput = document.getElementById('new-task-deadline').value;
            let formattedDate = dtInput ? new Date(dtInput).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) : 'No Deadline';

            const newTask = {
                id: 'm' + Date.now(),
                title: document.getElementById('new-task-title').value,
                course: document.getElementById('new-task-course').value,
                due: formattedDate,
                source: 'manual',
                sourceLabel: 'Manual Task',
                icon: 'fa-thumbtack',
                urgency: 'high', 
                content: document.getElementById('new-task-details').value || 'No additional details.'
            };
            
            window.AppStore.addTask(newTask);
            closeAddModal();
        });
    }

    // Modal Logic for details
    const detailsModal = document.getElementById('task-modal');
    if (detailsModal) {
        const btnClose = detailsModal.querySelector('.close-modal');
        const btnDismiss = document.getElementById('modal-btn-dismiss');
        const btnAction = document.getElementById('modal-btn-action');

        function closeDetailsModal() {
            detailsModal.style.opacity = '0';
            setTimeout(() => { detailsModal.style.display = 'none'; detailsModal.style.opacity = '1'; }, 300);
        }

        if(btnClose) btnClose.addEventListener('click', closeDetailsModal);
        if(btnDismiss) btnDismiss.addEventListener('click', closeDetailsModal);
        detailsModal.addEventListener('click', (e) => { if(e.target === detailsModal) closeDetailsModal(); });

        if(btnAction) {
            btnAction.addEventListener('click', () => {
                const id = detailsModal.dataset.activeTaskId;
                if(!id) return;
                
                const origText = btnAction.innerHTML;
                btnAction.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="margin-right:6px;"></i> Syncing...';
                btnAction.disabled = true;
                
                console.log(`[API MOCK TETHER] PUT backend.com/api/tasks/${id}/complete`);
                
                setTimeout(() => {
                    // Visually strip the task from global context via backend abstraction
                    if (window.AppStore && window.AppStore.removeTask) {
                        window.AppStore.removeTask(id);
                    }
                    
                    closeDetailsModal();
                    
                    // Reset UI silently while modal faded out
                    setTimeout(() => {
                        btnAction.innerHTML = origText;
                        btnAction.disabled = false;
                    }, 400); 
                }, 800);
            });
        }

        window.openDetailsModal = function(data, isInfoOnly = false) {
            // Track the active interaction element for backend deletion mapping
            detailsModal.dataset.activeTaskId = data.id || '';
            
            document.getElementById('modal-title').textContent = data.title;
            document.getElementById('modal-course').textContent = data.course;
            document.getElementById('modal-content').textContent = data.content;
            
            const modalSource = document.getElementById('modal-source');
            modalSource.className = 'modal-source ' + data.source;
            let iconHtml = '';
            
            if(data.source === 'whatsapp') { iconHtml = '<i class="fa-brands fa-whatsapp"></i>'; modalSource.style.cssText = 'background:var(--whatsapp-subtle);color:var(--whatsapp);border-color:rgba(76,202,122,0.3)'; }
            else if(data.source === 'classroom') { iconHtml = '<i class="fa-brands fa-google"></i>'; modalSource.style.cssText = 'background:var(--classroom-subtle);color:var(--classroom);border-color:rgba(251,188,4,0.3)'; }
            else if(data.source === 'gmail') { iconHtml = '<i class="fa-solid fa-envelope"></i>'; modalSource.style.cssText = 'background:var(--gmail-subtle);color:var(--gmail);border-color:rgba(234,67,53,0.3)'; }
            else { iconHtml = '<i class="fa-solid fa-thumbtack"></i>'; modalSource.style.cssText = 'background:var(--primary-subtle);color:var(--primary);border-color:rgba(108,99,255,0.3)'; }

            modalSource.innerHTML = iconHtml + ' ' + (data.sourceLabel || '');

            const modalDeadline = document.getElementById('modal-deadline');
            if (data.due && data.due !== 'No Deadline') { modalDeadline.parentElement.style.display = 'flex'; modalDeadline.textContent = data.due; } 
            else { modalDeadline.parentElement.style.display = 'none'; }

            if (btnAction) {
               btnAction.style.display = isInfoOnly ? 'none' : 'flex';
            }
            detailsModal.style.display = 'flex';
        }
    }

    // Topbar Notification Dropdown Logic
    const notifBtn = document.querySelector('.icon-btn.active-notif');
    if (notifBtn) {
        const wrapper = document.createElement('div');
        wrapper.className = 'topbar-wrapper';
        notifBtn.parentNode.insertBefore(wrapper, notifBtn);
        wrapper.appendChild(notifBtn);

        const dropdown = document.createElement('div');
        dropdown.className = 'notif-dropdown';
        dropdown.innerHTML = `
            <div class="notif-drop-header">
                <h3>Notifications</h3>
                <button class="text-btn text-primary">Mark all as read</button>
            </div>
            <div class="notif-drop-list">
                <div class="notif-drop-item unread">
                    <div class="nd-icon bg-whatsapp-subtle text-whatsapp"><i class="fa-brands fa-whatsapp"></i></div>
                    <div class="nd-content">
                        <h4>Class Rescheduled</h4>
                        <p>Tomorrows morning class is moved to 4 PM.</p>
                        <span>5 hours ago</span>
                    </div>
                </div>
                <div class="notif-drop-item">
                    <div class="nd-icon bg-warning-subtle text-warning"><i class="fa-brands fa-google"></i></div>
                    <div class="nd-content">
                        <h4>Slides Uploaded</h4>
                        <p>I have uploaded the slides covering CNNs.</p>
                        <span>2 hours ago</span>
                    </div>
                </div>
                <div class="notif-drop-item">
                    <div class="nd-icon bg-urgent-subtle text-urgent"><i class="fa-solid fa-envelope"></i></div>
                    <div class="nd-content">
                        <h4>Final Project Topic</h4>
                        <p>Reminder to email final project topics.</p>
                        <span>1 day ago</span>
                    </div>
                </div>
            </div>
        `;
        wrapper.appendChild(dropdown);

        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
            const pip = notifBtn.querySelector('.pip');
            if(pip) pip.style.display = 'none'; // Clear unread dot
        });

        document.addEventListener('click', (e) => {
            if(!wrapper.contains(e.target)) dropdown.classList.remove('show');
        });
    }

    // Global Reload/Sync Logic
    const globalSyncBtn = document.querySelector('.icon-btn[title="Sync integrations"]');
    if (globalSyncBtn) {
        globalSyncBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (globalSyncBtn.classList.contains('syncing')) return;
            
            globalSyncBtn.classList.add('syncing');
            const icon = globalSyncBtn.querySelector('i');
            icon.classList.add('fa-spin');

            console.log("[API MOCK TETHER] POST backend.com/api/sync/all");
            
            // Mock backend fetch call
            try {
                /*
                const res = await fetch('http://localhost:8000/api/sync/all', {
                    method: 'POST',
                    headers: {'Authorization': 'Bearer ' + localStorage.getItem('acadulse_auth_state')}
                });
                if(!res.ok) throw new Error('Global Sync Failed');
                */
                
                setTimeout(() => {
                    icon.classList.remove('fa-spin');
                    globalSyncBtn.classList.remove('syncing');
                    icon.classList.replace('fa-rotate-right', 'fa-check');
                    globalSyncBtn.style.color = 'var(--success)';
                    
                    // Dispatch event so other modules know data changed (e.g. dashboard.js can re-fetch)
                    window.dispatchEvent(new CustomEvent('global_sync_complete'));
                    
                    setTimeout(() => {
                        icon.classList.replace('fa-check', 'fa-rotate-right');
                        globalSyncBtn.style.color = '';
                    }, 2000);
                }, 1800);

            } catch (err) {
                console.error(err);
                icon.classList.remove('fa-spin');
                globalSyncBtn.classList.remove('syncing');
                alert("Global sync failed to reach backend.");
            }
        });
    }

    // Global Search Logic
    const searchInput = document.querySelector('.search-wrap input');
    const searchWrap = document.querySelector('.search-wrap');
    if (searchInput && searchWrap) {
        let debounceTimer;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'search-dropdown';
        searchWrap.appendChild(dropdown);

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length === 0) {
                dropdown.classList.remove('show');
                return;
            }
            
            dropdown.classList.add('show');
            dropdown.innerHTML = '<div class="search-status"><i class="fa-solid fa-circle-notch fa-spin text-primary" style="margin-right: 6px;"></i> Searching remote platforms...</div>';
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`[API MOCK TETHER] GET backend.com/api/search?q=${encodeURIComponent(query)}`);
                
                // MOCK API RESULTS DYNAMIC TO QUERY
                const mockResults = [
                    { title: `Assignment details for ${query}`, desc: 'Found in Google Classroom CS 401', icon: 'fa-google', cl: 'text-warning' },
                    { title: `Message from Class Rep`, desc: `Mentioned: "${query}" in WhatsApp group`, icon: 'fa-whatsapp', cl: 'text-whatsapp' }
                ];
                
                let html = '<div class="search-drop-list">';
                mockResults.forEach(res => {
                    html += `
                        <div class="search-result-item" onclick="alert('Result clicked!')">
                            <div class="icon"><i class="fa-brands ${res.icon} ${res.cl}"></i></div>
                            <div class="content">
                                <h4>${res.title}</h4>
                                <p>${res.desc}</p>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                dropdown.innerHTML = html;

            }, 600); // Debounce duration before reaching backend
        });

        // Detect click outside to dismiss
        document.addEventListener('click', (e) => {
            if(!searchWrap.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
        
        // Re-focus show capability
        searchInput.addEventListener('focus', () => {
            if(searchInput.value.trim().length > 0) dropdown.classList.add('show');
        });
    }

    // Global User Profile Modal Logic
    const profileSection = document.querySelector('.user-profile');
    if(profileSection) {
        const accountModal = document.createElement('div');
        accountModal.className = 'modal-overlay';
        accountModal.id = 'account-modal';
        accountModal.style.display = 'none';
        
        let initialName = localStorage.getItem('acad_user_name') || "Student Account";
        let initialEmail = "student@university.edu";
        let initialPhone = "+1 (555) 123-4567";

        accountModal.innerHTML = `
            <div class="modal-container">
              <div class="modal-header">
                <h2 class="panel-title"><i class="fa-solid fa-user-pen text-primary"></i> Account Settings</h2>
                <button class="icon-btn close-account-modal"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <form id="account-settings-form">
                <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
                  <div>
                      <label style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px; display: block;">Full Name</label>
                      <input type="text" id="acc-name" value="${initialName}" required style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text);">
                  </div>
                  <div>
                      <label style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px; display: block;">Primary Email (Classroom / Core)</label>
                      <input type="email" id="acc-email" value="${initialEmail}" required style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text);">
                  </div>
                  <div>
                      <label style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px; display: block;">WhatsApp Number</label>
                      <input type="text" id="acc-phone" value="${initialPhone}" style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text);">
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-outline close-account-modal">Cancel</button>
                  <button type="submit" class="btn btn-primary" id="btn-save-account">Save Changes</button>
                </div>
              </form>
            </div>
        `;
        document.body.appendChild(accountModal);

        // Core visual update function
        function setGlobalProfileDetails(fullName) {
            const nameDisplays = document.querySelectorAll('.user-name');
            const avatars = document.querySelectorAll('.avatar');
            const heroName = document.getElementById('hero-user-name');
            
            nameDisplays.forEach(el => el.textContent = fullName);
            avatars.forEach(el => {
                if (fullName.length > 0) el.textContent = fullName.substring(0, 2).toUpperCase();
            });
            
            if(heroName) {
                // Extract first name for the hero header
                heroName.textContent = fullName.split(' ')[0];
            }
        }
        
        // Execute initially on load
        setGlobalProfileDetails(initialName);

        const openModalOpts = () => { accountModal.style.display = 'flex'; };
        const closeModalOpts = () => { 
            accountModal.style.opacity = '0';
            setTimeout(() => { accountModal.style.display = 'none'; accountModal.style.opacity = '1'; }, 300);
        };

        // Attach listener strictly to the footer sidebar profile tile
        profileSection.addEventListener('click', openModalOpts);
        
        const closeBtns = accountModal.querySelectorAll('.close-account-modal');
        closeBtns.forEach(b => b.addEventListener('click', closeModalOpts));
        
        const accForm = document.getElementById('account-settings-form');
        const saveAccBtn = document.getElementById('btn-save-account');

        accForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = document.getElementById('acc-name').value.trim();
            const newEmail = document.getElementById('acc-email').value.trim();
            const newPhone = document.getElementById('acc-phone').value.trim();

            const payload = { full_name: newName, email: newEmail, phone: newPhone };

            saveAccBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
            saveAccBtn.disabled = true;

            console.log("[API MOCK TETHER] PUT backend.com/api/users/profile", payload);

            setTimeout(() => {
                saveAccBtn.innerHTML = 'Save Changes';
                saveAccBtn.disabled = false;
                
                // Keep updated locally for refresh persistence
                localStorage.setItem('acad_user_name', newName);
                
                // Live UI updates
                setGlobalProfileDetails(newName);
                closeModalOpts();
            }, 1000);
        });
    }
});
