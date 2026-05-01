// integrations.js
document.addEventListener('DOMContentLoaded', () => {

    let integrations = [
        { id: 'whatsapp', platform: 'WhatsApp', icon: 'fa-whatsapp', colorCls: 'text-whatsapp', bgCls: 'bg-whatsapp-subtle', status: 'Active', statusCls: 'text-success', detail: '+1 (555) 123-4567', lastSync: '2 mins ago' },
        { id: 'classroom', platform: 'Google Classroom', icon: 'fa-google', colorCls: 'text-warning', bgCls: 'bg-warning-subtle', status: 'Syncing', statusCls: 'text-warning', detail: 'student@university.edu', lastSync: 'Currently syncing...' },
        { id: 'gmail', platform: 'Gmail', icon: 'fa-envelope', colorCls: 'text-urgent', bgCls: 'bg-urgent-subtle', status: 'Active', statusCls: 'text-success', detail: 'student@university.edu', lastSync: '10 mins ago' }
    ];

    function renderIntegrations() {
        const container = document.getElementById('integrations-list');
        if(!container) return;
        container.innerHTML = '';

        integrations.forEach(intg => {
            const card = document.createElement('div');
            card.className = 'panel';
            
            // Adjust fa-solid/brands logic purely for visual icon perfection
            let faType = 'fa-brands';
            if (intg.id === 'gmail') faType = 'fa-solid';

            // Custom active UI for current sync
            let syncIcon = intg.status === 'Syncing' ? '<i class="fa-solid fa-rotate fa-spin" style="margin-right:4px;"></i>' : '<i class="fa-solid fa-circle-check" style="margin-right:4px;"></i>';

            card.innerHTML = `
                <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h2 class="panel-title"><i class="${faType} ${intg.icon} ${intg.colorCls}"></i> ${intg.platform}</h2>
                    <span class="${intg.statusCls}" style="font-size: 13px; font-weight: 600; display:flex; align-items:center;">
                        ${syncIcon} ${intg.status}
                    </span>
                </div>
                <div style="padding: 24px; display:flex; flex-direction:column; gap: 16px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Connected Account</div>
                        <div style="font-size: 15px; font-weight: 500; color: var(--text);">${intg.detail}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Last Synced</div>
                        <div style="font-size: 13px; color: var(--text);">${intg.lastSync}</div>
                    </div>
                    <div style="margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--border); display:flex; gap:12px;">
                        <button class="btn btn-outline btn-sync" data-id="${intg.id}" style="flex:1;"><i class="fa-solid fa-rotate-right"></i> Force Sync</button>
                        <button class="btn btn-outline btn-unlink" data-id="${intg.id}" style="color: var(--urgent); border-color: var(--urgent-subtle);"><i class="fa-solid fa-unlink"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderIntegrations();

    // Event Delegation for action buttons
    document.getElementById('integrations-list').addEventListener('click', (e) => {
        const syncBtn = e.target.closest('.btn-sync');
        const unlinkBtn = e.target.closest('.btn-unlink');
        
        if (syncBtn) {
            const id = syncBtn.dataset.id;
            const intg = integrations.find(i => i.id === id);
            if(intg && intg.status !== 'Syncing') {
                intg.status = 'Syncing';
                intg.statusCls = 'text-warning';
                intg.lastSync = 'Currently syncing...';
                renderIntegrations();
                
                // MOCK API FETCH
                console.log(`[API MOCK] POST backend.com/api/sync/${id}`);
                setTimeout(() => {
                    intg.status = 'Active';
                    intg.statusCls = 'text-success';
                    intg.lastSync = 'Just now';
                    renderIntegrations();
                }, 2000);
            }
        }
        
        if (unlinkBtn) {
            const id = unlinkBtn.dataset.id;
            if(confirm('Are you sure you want to disconnect this platform? You will stop receiving its notifications via AcadPulse.')) {
                // MOCK API DELETE
                console.log(`[API MOCK] DELETE backend.com/api/integrations/${id}`);
                integrations = integrations.filter(i => i.id !== id);
                renderIntegrations();
            }
        }
    });
});
