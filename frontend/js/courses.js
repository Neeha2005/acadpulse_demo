// courses.js
document.addEventListener('DOMContentLoaded', () => {
    const mockCourses = [
        { code: 'CS 401', name: 'Artificial Intelligence', professor: 'Dr. Alan Turing', sources: ['whatsapp', 'classroom'] },
        { code: 'SE 301', name: 'Software Engineering', professor: 'Prof. Ada Lovelace', sources: ['classroom'] },
        { code: 'MTH 302', name: 'Linear Algebra', professor: 'Dr. Euler', sources: ['gmail'] }
    ];

    function renderCourses() {
        const grid = document.getElementById('courses-grid');
        if(!grid) return;
        grid.innerHTML = '';
        
        mockCourses.forEach(course => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.cursor = 'default';
            
            let sourceHtml = '';
            if(course.sources.includes('whatsapp')) sourceHtml += '<i class="fa-brands fa-whatsapp text-whatsapp" style="margin-right: 8px;"></i>';
            if(course.sources.includes('classroom')) sourceHtml += '<i class="fa-brands fa-google text-warning" style="margin-right: 8px;"></i>';
            if(course.sources.includes('gmail')) sourceHtml += '<i class="fa-solid fa-envelope text-urgent" style="margin-right: 8px;"></i>';

            card.innerHTML = `
                <div class="stat-header" style="margin-bottom: 8px;">
                    <div class="stat-icon bg-primary-subtle text-primary"><i class="fa-solid fa-book"></i></div>
                    <div class="stat-trend neutral">${sourceHtml}</div>
                </div>
                <div class="stat-value" style="font-size: 24px;">${course.code}</div>
                <div class="stat-label" style="font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 6px;">${course.name}</div>
                <div class="stat-label" style="font-size: 13px;"><i class="fa-solid fa-user-tie"></i> ${course.professor}</div>
            `;
            grid.appendChild(card);
        });
    }

    renderCourses();
});
