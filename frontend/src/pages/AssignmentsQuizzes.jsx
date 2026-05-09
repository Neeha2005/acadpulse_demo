import { useMemo, useRef, useState } from 'react';
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

function getSourceMeta(task) {
  const source = task.source || '';

  if (source === 'whatsapp') {
    return {
      iconFamily: 'fa-brands',
      icon: 'fa-whatsapp',
      label: task.sourceLabel || 'WhatsApp',
      tone: 'whatsapp',
    };
  }

  if (source === 'classroom') {
    return {
      iconFamily: 'fa-brands',
      icon: 'fa-google',
      label: task.sourceLabel || 'Classroom',
      tone: 'classroom',
    };
  }

  if (source === 'gmail') {
    return {
      iconFamily: 'fa-solid',
      icon: 'fa-envelope',
      label: task.sourceLabel || 'Gmail',
      tone: 'gmail',
    };
  }

  return {
    iconFamily: 'fa-solid',
    icon: task.icon || 'fa-thumbtack',
    label: task.sourceLabel || 'Manual',
    tone: 'manual',
  };
}

export default function AssignmentsQuizzes() {
  const {
    tasks,
    refreshNotifications,
    dataLoading,
    completeTask,
    setActiveTaskModal,
    user,
  } = useAppContext();
  const [typeFilter, setTypeFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState('');
  const queueRef = useRef(null);

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
  const completedCount = academicTasks.filter((task) => task.isCompleted).length;
  const displayStudentName = user?.fullName || 'Scholar';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleComplete = async (event, task) => {
    event.stopPropagation();
    setCompletingTaskId(task.id);
    try {
      await completeTask(task);
    } finally {
      setCompletingTaskId('');
    }
  };

  if (dataLoading) return <PageSkeleton variant="cards" />;

  return (
    <div className="dashboard-scroll assignments-page">
      <section className="assignments-hero glass-banner">
        <div className="assignments-hero-copy">
          <span className="hero-kicker">Academic Workload</span>
          <h1 className="hero-title">Assignments & Quizzes</h1>
          <p className="assignments-hero-text">
            Stay on top of every assignment, quiz, and due date flowing in from WhatsApp, Gmail,
            Classroom, and manual capture.
          </p>
          <div className="assignments-hero-actions">
            <button
              className="btn btn-primary assignments-hero-cta"
              type="button"
              onClick={() => queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <i className="fa-solid fa-layer-group"></i> View Work Queue
            </button>
          </div>
        </div>

        <div className="assignments-hero-visual">
          <div className="assignments-orbit assignments-orbit-gold"></div>
          <div className="assignments-orbit assignments-orbit-cyan"></div>
          <div className="assignments-core-halo"></div>
          <div className="assignments-hero-board">
            <div className="assignments-hero-board-head">
              <div className="assignments-hero-board-cap"></div>
              <div className="assignments-hero-board-cap"></div>
              <div className="assignments-hero-board-cap"></div>
            </div>
            <div className="assignments-hero-board-grid compact">
              {Array.from({ length: 12 }, (_, index) => (
                <span
                  key={`cell-${index}`}
                  className={`assignments-board-cell ${index === 7 ? 'active' : ''} ${index === 10 ? 'done' : ''}`}
                ></span>
              ))}
            </div>
            <div className="assignments-hero-board-footer">
              <span className="assignments-board-footer-pill">Deadline Matrix</span>
            </div>
          </div>
          <div className="assignments-floating-card top">
            <span className="floating-label">Next Deadline</span>
            <strong>{visibleTasks[0]?.due || 'No deadline'}</strong>
          </div>
          <div className="assignments-floating-card side">
            <span className="floating-label">Due This Week</span>
            <strong>{upcomingCount} due</strong>
          </div>
          <div className="assignments-floating-card bottom">
            <span className="floating-label">Completed</span>
            <strong>{completedCount} done</strong>
          </div>
        </div>

        <div className="assignments-hero-summary">
          <div className="assignments-summary-card urgent">
            <span>Urgent</span>
            <strong>{urgentCount}</strong>
            <small>Needs attention</small>
          </div>
          <div className="assignments-summary-card assignments">
            <span>Assignments</span>
            <strong>{assignmentCount}</strong>
            <small>Total assignments</small>
          </div>
          <div className="assignments-summary-card quizzes">
            <span>Quizzes</span>
            <strong>{quizCount}</strong>
            <small>Total quizzes</small>
          </div>
        </div>
      </section>

      <section className="assignments-stats-grid">
        <article className="assignments-stat-card glass-card">
          <div className="assignments-stat-head">
            <div className="assignments-stat-icon assignments-stat-icon-gold">
              <i className="fa-solid fa-file-pen"></i>
            </div>
            <span className="assignments-stat-helper">Active queue</span>
          </div>
          <div className="assignments-stat-value">{assignmentCount}</div>
          <div className="assignments-stat-label">Assignments</div>
          <p className="assignments-stat-copy">Deadline-bearing coursework pulled into one premium workspace.</p>
        </article>

        <article className="assignments-stat-card glass-card">
          <div className="assignments-stat-head">
            <div className="assignments-stat-icon assignments-stat-icon-green">
              <i className="fa-solid fa-circle-question"></i>
            </div>
            <span className="assignments-stat-helper">Quiz items</span>
          </div>
          <div className="assignments-stat-value">{quizCount}</div>
          <div className="assignments-stat-label">Quizzes</div>
          <p className="assignments-stat-copy">Short checks, surprise quizzes, and class assessments in one flow.</p>
        </article>

        <article className="assignments-stat-card glass-card">
          <div className="assignments-stat-head">
            <div className="assignments-stat-icon assignments-stat-icon-red">
              <i className="fa-solid fa-clock"></i>
            </div>
            <span className="assignments-stat-helper">With due dates</span>
          </div>
          <div className="assignments-stat-value">{upcomingCount}</div>
          <div className="assignments-stat-label">Scheduled Deadlines</div>
          <p className="assignments-stat-copy">Everything with a concrete due date surfaced for clean planning.</p>
        </article>
      </section>

      <section className="assignments-queue-shell glass-panel panel-accent" ref={queueRef}>
        <div className="assignments-queue-ambient assignments-queue-ambient-gold"></div>
        <div className="assignments-queue-ambient assignments-queue-ambient-cyan"></div>

        <div className="assignments-queue-header">
          <div className="assignments-queue-title-wrap">
            <div className="assignments-queue-title-icon">
              <i className="fa-solid fa-list-check"></i>
            </div>
            <div>
              <h2 className="assignments-queue-title">Work Queue</h2>
              <p className="assignments-queue-count">{visibleTasks.length} of {academicTasks.length} tasks visible</p>
            </div>
          </div>
          <button className="btn btn-outline assignments-queue-refresh" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div className="assignments-queue-divider"></div>

        <div className="assignments-filter-bar">
          <div className="assignments-filter-group glass-pill-group">
            <span className="assignments-filter-label">Type</span>
            <div className="assignments-filter-controls">
              {TYPE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${typeFilter === filter ? 'active' : ''}`} onClick={() => setTypeFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="assignments-filter-group glass-pill-group">
            <span className="assignments-filter-label">Source</span>
            <div className="assignments-filter-controls">
              {SOURCE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="assignments-filter-group glass-pill-group">
            <span className="assignments-filter-label">Course</span>
            <div className="assignments-filter-select-wrap">
              <select className="list-filter-select assignments-filter-select" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                {courseOptions.map((course) => (
                  <option key={course} value={course}>{course === 'All' ? 'All courses' : course}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="assignments-filter-group glass-pill-group">
            <span className="assignments-filter-label">Status</span>
            <div className="assignments-filter-controls">
              {STATUS_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${statusFilter === filter ? 'active' : ''}`} onClick={() => setStatusFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="assignments-queue-list">
          {visibleTasks.length > 0 ? (
            visibleTasks.map((task) => {
              const urgencyLabel = (task.urgencyLabel || 'none').toLowerCase();
              const urgencyTone = urgencyLabel === 'overdue'
                ? 'overdue'
                : task.urgency === 'urgent'
                  ? 'urgent'
                  : task.urgency === 'warning'
                    ? 'warning'
                    : 'normal';
              const sourceMeta = getSourceMeta(task);

              return (
                <article
                  key={task.id}
                  className={`assignment-queue-card ${urgencyTone}`}
                  onClick={(event) => {
                    if (event.target.closest('button')) return;
                    setActiveTaskModal(task);
                  }}
                >
                  <div className="assignment-queue-priority-bar"></div>

                  <div className="assignment-queue-main">
                    <div className="assignment-queue-top">
                      <div className="assignment-queue-student">
                        <span className="assignment-queue-student-avatar">
                          {displayStudentName.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>{displayStudentName}</strong>
                          <span>{task.course || 'Unassigned course'}</span>
                        </div>
                      </div>
                      <span className={`assignment-queue-due ${urgencyTone}`}>
                        <i className="fa-solid fa-clock"></i> {task.due}
                      </span>
                    </div>

                    <h3 className="assignment-queue-title">{task.title}</h3>

                    <div className="assignment-queue-meta">
                      <span className={`assignment-queue-source ${sourceMeta.tone}`}>
                        <i className={`${sourceMeta.iconFamily} ${sourceMeta.icon}`}></i>
                        {sourceMeta.label}
                      </span>
                      {task.course && <span className="assignment-queue-chip">{task.course}</span>}
                      {urgencyLabel !== 'none' && <span className={`assignment-queue-chip urgency ${urgencyTone}`}>{urgencyLabel}</span>}
                    </div>
                  </div>

                  <div className="assignment-queue-actions">
                    <button
                      className="btn btn-outline assignment-queue-btn"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveTaskModal(task);
                      }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i> View
                    </button>
                    <button
                      className="btn btn-primary assignment-queue-btn assignment-queue-btn-primary"
                      type="button"
                      onClick={(event) => handleComplete(event, task)}
                      disabled={completingTaskId === task.id}
                    >
                      {completingTaskId === task.id
                        ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Marking</>
                        : <><i className="fa-solid fa-check"></i> Mark Done</>}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state glass-empty-state assignments-empty-state">
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
      </section>
    </div>
  );
}
