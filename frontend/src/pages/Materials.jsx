import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import AttachmentList from '../components/AttachmentList';
import PageSkeleton from '../components/PageSkeleton';

const SOURCE_FILTERS = ['All', 'WhatsApp', 'Classroom', 'Gmail', 'Manual'];
const TYPE_FILTERS = ['All', 'PDF', 'Slides', 'Video', 'Link', 'Notes'];

function getTime(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isMaterial(notification) {
  if ((notification.category || '').toLowerCase() === 'material') return true;
  return hasMaterialAttachment(notification);
}

function getAttachmentSignature(attachment) {
  return `${attachment?.file_type || ''} ${attachment?.file_name || ''}`.toLowerCase();
}

function isMaterialAttachment(attachment) {
  const signature = getAttachmentSignature(attachment);
  return (
    signature.includes('pdf')
    || signature.includes('slide')
    || signature.includes('ppt')
    || signature.includes('presentation')
    || signature.includes('video')
    || signature.includes('youtube')
    || signature.includes('document')
    || signature.includes('sheet')
    || signature.includes('text/url')
    || signature.includes('link')
    || signature.includes('note')
    || signature.includes('.pdf')
    || signature.includes('.ppt')
    || signature.includes('.pptx')
    || signature.includes('.doc')
    || signature.includes('.docx')
  );
}

function hasMaterialAttachment(notification) {
  const attachments = Array.isArray(notification.attachments) ? notification.attachments : [];
  return attachments.some(isMaterialAttachment);
}

function detectMaterialType(notification) {
  const attachments = Array.isArray(notification.attachments) ? notification.attachments : [];
  const attachmentText = attachments.map(getAttachmentSignature).join(' ');
  const text = `${notification.title || ''} ${notification.preview || ''} ${notification.rawText || ''}`.toLowerCase();
  const combined = `${text} ${attachmentText}`;
  if (combined.includes('pdf')) return 'PDF';
  if (combined.includes('slide') || combined.includes('ppt') || combined.includes('presentation')) return 'Slides';
  if (combined.includes('youtube') || combined.includes('video')) return 'Video';
  if (combined.includes('http') || combined.includes('link') || combined.includes('text/url')) return 'Link';
  if (combined.includes('note') || combined.includes('reading') || combined.includes('document') || combined.includes('doc')) return 'Notes';
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
    <div className="dashboard-scroll materials-page">
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

        <div className="list-filter-grid">
          <div className="filters glass-pill-group list-filter-group">
            {SOURCE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          <div className="filters glass-pill-group list-filter-group">
            {TYPE_FILTERS.map((filter) => (
              <button key={filter} className={`filter-btn glass-filter-pill ${typeFilter === filter ? 'active' : ''}`} onClick={() => setTypeFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="notification-stream" style={{ padding: '8px 24px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {visibleMaterials.length === 0 && (
            <div className="empty-state glass-empty-state" style={{ gridColumn: '1 / -1', margin: '0 0 16px' }}>
              <div className="empty-state-icon"><i className="fa-solid fa-folder-open"></i></div>
              <p style={{ margin: '8px 0 4px' }}>
                {materials.length === 0 ? 'No materials found' : 'No items match your filters'}
              </p>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {materials.length === 0
                  ? 'Lecture notes, PDFs, slides, and links shared in WhatsApp groups or Google Classroom will appear here.'
                  : 'Try adjusting the source or type filter above.'}
              </span>
            </div>
          )}
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
                  {material.attachmentCount > 0 && (
                    <span className="badge badge-muted">
                      {material.attachmentCount} attachment{material.attachmentCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <AttachmentList attachments={material.attachments} compact />
              </div>
            </div>
          )) : null}
        </div>
      </div>
    </div>
  );
}
