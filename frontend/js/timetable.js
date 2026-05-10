// timetable.js
document.addEventListener('DOMContentLoaded', () => {
    const mockTimetable = [
        { day: 'Monday', time: '09:00 AM - 10:30 AM', course: 'CS 401 - Artificial Intelligence', room: 'Hall A' },
        { day: 'Monday', time: '11:00 AM - 12:30 PM', course: 'SE 301 - Software Engineering', room: 'Room 205' },
        { day: 'Tuesday', time: '10:00 AM - 11:30 AM', course: 'MTH 302 - Linear Algebra', room: 'Room 102' },
        { day: 'Wednesday', time: '09:00 AM - 10:30 AM', course: 'CS 401 - Artificial Intelligence', room: 'Hall A' },
        { day: 'Thursday', time: '02:00 PM - 05:00 PM', course: 'CS 401 Lab', room: 'Lab 3' }
    ];

    function renderTimetable() {
        const stream = document.getElementById('timetable-stream');
        if(!stream) return;
        stream.innerHTML = '';
        
        mockTimetable.forEach(item => {
            const card = document.createElement('div');
            card.className = 'notif-item'; 
            card.style.cursor = 'default';
            card.innerHTML = `
                <div class="notif-icon-wrap" style="background: var(--primary-subtle); color: var(--primary);">
                    <i class="fa-regular fa-clock"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-header">
                        <span class="notif-sender">${item.day}</span>
                        <span class="notif-time text-primary" style="font-weight: 500;">${item.time}</span>
                    </div>
                    <h4 class="notif-title">${item.course}</h4>
                    <p class="notif-preview"><i class="fa-solid fa-location-dot"></i> ${item.room}</p>
                </div>
            `;
            stream.appendChild(card);
        });
    }

    renderTimetable();
});
