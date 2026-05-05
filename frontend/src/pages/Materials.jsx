import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import PageSkeleton from '../components/PageSkeleton';

const SOURCE_FILTERS = ['All', 'WhatsApp', 'Classroom', 'Gmail', 'Manual'];
const TYPE_FILTERS = ['All', 'PDF', 'Slides', 'Video', 'Link', 'Notes'];

function getTime(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isMaterial(notification) {
  return (notification.category || '').toLowerCase() === 'material';
}

function detectMaterialType(notification) {
  const text = `${notification.title || ''} ${notification.preview || ''} ${notification.rawText || ''}`.toLowerCase();
  if (text.includes('pdf')) return 'PDF';
  if (text.includes('slide') || text.includes('ppt')) return 'Slides';
  if (text.includes('youtube') || text.includes('video')) return 'Video';
  if (text.includes('http') || text.includes('link')) return 'Link';
  if (text.includes('note') || text.includes('reading')) return 'Notes';
  return 'Notes';
}

function getMaterialIcon(type) {
  switch (type) {
    case 'PDF':
      return 'fa-file-pdf';
    case 'Slides':
      return 'fa-file-powerpoint';
    case 'Video':
      return 'fa-circle-play';
    case 'Link':
      return 'fa-link';
    default:
      return 'fa-file-lines';
  }
}

export default function Materials() {
  const { notifications, refreshNotifications, dataLoading } = useAppContext();
  const [sourceFilter, setSourceFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const materials = useMemo(
    () => notifications
      .filter(isMaterial)
      .map((item) => ({ ...item, materialType: detectMaterialType(item) }))
      .slice()
      .sort((a, b) => getTime(b.receivedAt || b.createdAt) - getTime(a.receivedAt || a.createdAt)),
    [notifications],
  );

  const visibleMaterials = useMemo(() => materials.filter((material) => {
    const source = (material.sourceLabel || material.source || '').toLowerCase();
    if (sourceFilter !== 'All' && source !== sourceFilter.toLowerCase()) return false;
    if (typeFilter !== 'All' && material.materialType !== typeFilter) return false;
    return true;
  }), [materials, sourceFilter, typeFilter]);

  const classroomCount = materials.filter((item) => item.source === 'classroom').length;
  const pdfCount = materials.filter((item) => item.materialType === 'PDF').length;
  const linkCount = materials.filter((item) => item.materialType === 'Link' || item.materialType === 'Video').length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (dataLoading) return <PageSkeleton variant="list" />;

  return (
    <div className="dashboard-scroll">
      <section className="hero-stats glass-banner">
        <div className="welcome-text">
          <span className="hero-kicker">STUDY RESOURCES</span>
          <h1 className="hero-title">Materials</h1>
          <p>
            Browse notes, PDFs, slides, videos, readings, and reference links collected from connected academic channels.
          </p>
        </div>
        <div className="hero-pill-group">
          <div className="hero-pill hero-pill-critical">
            <span className="hero-pill-label">PDFs</span>
            <strong>{pdfCount}</strong>
          </div>
          <div className="hero-pill hero-pill-pending">
            <span className="hero-pill-label">Classroom</span>
            <strong>{classroomCount}</strong>
          </div>
          <div className="hero-pill hero-pill-messages">
            <span className="hero-pill-label">Links</span>
            <strong>{linkCount}</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-pending"><i className="fa-solid fa-folder-open"></i></div>
            <div className="stat-trend trend-pill trend-pill-pending">resource feed</div>
          </div>
          <div className="stat-value stat-value-pending">{materials.length}</div>
          <div className="stat-label">Total Materials</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-messages"><i className="fa-solid fa-file-pdf"></i></div>
            <div className="stat-trend trend-pill trend-pill-messages">documents</div>
          </div>
          <div className="stat-value stat-value-messages">{pdfCount}</div>
          <div className="stat-label">PDF Resources</div>
        </div>
        <div className="stat-card glass-card">
          <div className="stat-header">
            <div className="stat-icon stat-icon-urgent"><i className="fa-solid fa-link"></i></div>
            <div className="stat-trend trend-pill trend-pill-urgent">external</div>
          </div>
          <div className="stat-value stat-value-urgent">{linkCount}</div>
          <div className="stat-label">Links & Videos</div>
        </div>
      </div>

      <div className="panel glass-panel panel-accent" style={{ marginTop: 24 }}>
        <div className="panel-header" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h2 className="panel-title"><i className="fa-solid fa-book-open-reader text-primary"></i> Resource Library</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {visibleMaterials.length} of {materials.length} items visible
            </p>
          </div>
          <button className="btn btn-outline" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div style={{ padding: '0 24px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div className="filters glass-pill-group" style={{ flexWrap: 'wrap' }}>
            {SOURCE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          <div className="filters glass-pill-group" style={{ flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${typeFilter === filter ? 'active' : ''}`} onClick={() => setTypeFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="notification-stream" style={{ padding: '8px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {visibleMaterials.length > 0 ? visibleMaterials.map((material) => (
            <div className="notif-item" key={material.id} style={{ alignItems: 'flex-start' }}>
              <div className={`notif-icon-wrap ${material.source}`}>
                <i className={`fa-solid ${getMaterialIcon(material.materialType)}`}></i>
              </div>
              <div className="notif-content">
                <div className="notif-header">
                  <span className="notif-sender">{material.sender}</span>
                  <span className="notif-time">{material.time}</span>
                </div>
                <h4 className="notif-title">{material.title}</h4>
                <p className="notif-preview">{material.preview}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <span className="badge badge-success">{material.materialType}</span>
                  <span className="badge badge-warning">{material.sourceLabel}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="empty-state glass-empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon"><i className="fa-solid fa-folder-open"></i></div>
              <p>No matching materials</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
