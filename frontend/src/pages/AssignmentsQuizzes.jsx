import { useMemo, useState } from 'react';
import TaskCard from '../components/TaskCard';
import { useAppContext } from '../context/AppContext';
import PageSkeleton from '../components/PageSkeleton';

const TYPE_FILTERS = ['All', 'Assignments', 'Quizzes'];
const SOURCE_FILTERS = ['All', 'WhatsApp', 'Classroom', 'Gmail', 'Manual'];
const STATUS_FILTERS = ['All', 'Pending', 'Done', 'Overdue'];

function normalizeType(category) {
  return (category || '').toLowerCase() === 'quiz' ? 'quiz' : 'assignment';
}

function getDeadlineTime(task) {
  if (!task.deadline) return Number.POSITIVE_INFINITY;
  const parsed = new Date(task.deadline);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}

function isAssignmentOrQuiz(task) {
  const category = (task.category || '').toLowerCase();
  return category === 'assignment' || category === 'quiz';
}

export default function AssignmentsQuizzes() {
  const { tasks, refreshNotifications, dataLoading } = useAppContext();
  const [typeFilter, setTypeFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const academicTasks = useMemo(
    () => tasks
      .filter(isAssignmentOrQuiz)
      .slice()
      .sort((a, b) => getDeadlineTime(a) - getDeadlineTime(b)),
    [tasks],
  );

  const visibleTasks = useMemo(() => academicTasks.filter((task) => {
    const type = normalizeType(task.category);
    const source = (task.sourceLabel || task.source || '').toLowerCase();
    const course = task.course || 'Unassigned';
    const isOverdue = (task.urgencyLabel || '').toLowerCase() === 'overdue';

    if (typeFilter !== 'All' && type !== typeFilter.toLowerCase().replace(/s$/, '')) return false;
    if (sourceFilter !== 'All' && source !== sourceFilter.toLowerCase()) return false;
    if (courseFilter !== 'All' && course !== courseFilter) return false;
    if (statusFilter === 'Pending' && (task.isCompleted || isOverdue)) return false;
    if (statusFilter === 'Done' && !task.isCompleted) return false;
    if (statusFilter === 'Overdue' && !isOverdue) return false;
    return true;
  }), [academicTasks, courseFilter, sourceFilter, statusFilter, typeFilter]);

  const courseOptions = useMemo(
    () => ['All', ...Array.from(new Set(academicTasks.map((task) => task.course || 'Unassigned'))).sort()],
    [academicTasks],
  );

  const assignmentCount = academicTasks.filter((task) => normalizeType(task.category) === 'assignment').length;
  const quizCount = academicTasks.filter((task) => normalizeType(task.category) === 'quiz').length;
  const urgentCount = academicTasks.filter((task) => task.urgency === 'urgent').length;
  const upcomingCount = academicTasks.filter((task) => Number.isFinite(getDeadlineTime(task))).length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (dataLoading) return <PageSkeleton variant="cards" />;

  return (
    <div className="dashboard-scroll assignments-page">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">ACADEMIC WORKLOAD</span>
          <h1 className="hero-title">Assignments & Quizzes</h1>
          <p>
            Track deadline-bearing coursework from WhatsApp, Gmail, Classroom, and manual entries.
          </p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">Urgent</span>
            <strong>{urgentCount}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Assignments</span>
            <strong>{assignmentCount}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Quizzes</span>
            <strong>{quizCount}</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-pending"><i className="fa-solid fa-file-pen"></i></div>
            <div className="stat-trend trend-pill trend-pill-pending">active queue</div>
          </div>
          <div className="stat-value stat-value-pending">{assignmentCount}</div>
          <div className="stat-label">Assignments</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-messages"><i className="fa-solid fa-circle-question"></i></div>
            <div className="stat-trend trend-pill trend-pill-messages">quiz items</div>
          </div>
          <div className="stat-value stat-value-messages">{quizCount}</div>
          <div className="stat-label">Quizzes</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-urgent"><i className="fa-solid fa-clock"></i></div>
            <div className="stat-trend trend-pill trend-pill-urgent">with due dates</div>
          </div>
          <div className="stat-value stat-value-urgent">{upcomingCount}</div>
          <div className="stat-label">Scheduled Deadlines</div>
        </div>
      </div>

      <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
        <div className="panel-header" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h2 className="panel-title"><i className="fa-solid fa-list-check text-primary"></i> Work Queue</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {visibleTasks.length} of {academicTasks.length} items visible
            </p>
          </div>
          <button className="btn btn-outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div className="list-filter-grid">
          <div className="filters glass-pill-group list-filter-group">
            {TYPE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${typeFilter === filter ? 'active' : ''}`} onClick={() => setTypeFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          <div className="filters glass-pill-group list-filter-group">
            {SOURCE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          <select className="list-filter-select" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
            {courseOptions.map((course) => (
              <option key={course} value={course}>{course === 'All' ? 'All courses' : course}</option>
            ))}
          </select>
          <div className="filters glass-pill-group list-filter-group">
            {STATUS_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${statusFilter === filter ? 'active' : ''}`} onClick={() => setStatusFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="tasks-list" style={{ padding: '8px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {visibleTasks.length > 0 ? (
            visibleTasks.map((task) => <TaskCard key={task.id} task={task} />)
          ) : (
            <div className="empty-state glass-empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon"><i className="fa-solid fa-folder-open"></i></div>
              <p style={{ margin: '8px 0 4px' }}>
                {academicTasks.length === 0 ? 'No assignments or quizzes found' : 'No items match your filters'}
              </p>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {academicTasks.length === 0
                  ? 'Assignments and quizzes appear here once your WhatsApp, Gmail, or Classroom sources send deadline-bearing messages.'
                  : 'Try changing the type, source, or status filter above.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
