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

function getSourceMeta(material) {
  const source = (material.source || '').toLowerCase();
  if (source === 'whatsapp') {
    return { iconFamily: 'fa-brands', icon: 'fa-whatsapp', tone: 'whatsapp', label: material.sourceLabel || 'WhatsApp' };
  }
  if (source === 'classroom') {
    return { iconFamily: 'fa-brands', icon: 'fa-google', tone: 'classroom', label: material.sourceLabel || 'Classroom' };
  }
  if (source === 'gmail') {
    return { iconFamily: 'fa-solid', icon: 'fa-envelope', tone: 'gmail', label: material.sourceLabel || 'Gmail' };
  }
  return { iconFamily: material.iconFamily || 'fa-solid', icon: material.icon || 'fa-thumbtack', tone: 'manual', label: material.sourceLabel || 'Manual' };
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
      <section className="materials-hero glass-banner">
        <div className="materials-hero-copy">
          <span className="hero-kicker">STUDY RESOURCES</span>
          <h1 className="hero-title">Materials</h1>
          <p className="materials-hero-text">
            Browse notes, PDFs, slides, videos, readings, and reference links from connected academic channels.
          </p>
          <div className="materials-hero-signals">
            <span className="materials-hero-signal"><i className="fa-solid fa-folder-tree"></i> Organized Resources</span>
            <span className="materials-hero-signal"><i className="fa-solid fa-magnifying-glass"></i> Smart Search</span>
            <span className="materials-hero-signal"><i className="fa-solid fa-circle-nodes"></i> Connected Libraries</span>
          </div>
        </div>

        <div className="materials-hero-visual">
          <div className="materials-visual-ambient ambient-emerald"></div>
          <div className="materials-visual-ambient ambient-cyan"></div>
          <div className="materials-grid-pattern"></div>
          <div className="materials-network-line line-one"></div>
          <div className="materials-network-line line-two"></div>
          <div className="materials-network-node node-left"></div>
          <div className="materials-network-node node-right"></div>
          <div className="materials-network-node node-bottom"></div>

          <div className="materials-folder-stack">
            <div className="materials-folder-card back"></div>
            <div className="materials-folder-card middle"></div>
            <div className="materials-folder-card front">
              <div className="materials-folder-glow"></div>
              <i className="fa-solid fa-folder-open"></i>
            </div>
          </div>

          <div className="materials-float-card pdf">
            <div className="materials-float-icon"><i className="fa-solid fa-file-pdf"></i></div>
            <div className="materials-float-copy">
              <strong>PDF</strong>
              <span>Resource bundle</span>
            </div>
          </div>

          <div className="materials-float-card slides">
            <div className="materials-float-icon"><i className="fa-solid fa-file-powerpoint"></i></div>
            <div className="materials-float-copy">
              <strong>Slides</strong>
              <span>Lecture deck</span>
            </div>
          </div>

          <div className="materials-float-card notes">
            <div className="materials-float-icon"><i className="fa-solid fa-file-lines"></i></div>
            <div className="materials-float-copy">
              <strong>Notes</strong>
              <span>Study sheet</span>
            </div>
          </div>
        </div>

        <div className="materials-hero-rail">
          <div className="materials-hero-rail-card pdfs">
            <div className="materials-hero-rail-icon"><i className="fa-solid fa-file-pdf"></i></div>
            <div className="materials-hero-rail-copy">
              <strong>PDFs</strong>
              <span>Total PDFs</span>
            </div>
            <div className="materials-hero-rail-value">{pdfCount}</div>
          </div>
          <div className="materials-hero-rail-card classroom">
            <div className="materials-hero-rail-icon"><i className="fa-brands fa-google"></i></div>
            <div className="materials-hero-rail-copy">
              <strong>Classroom</strong>
              <span>From Classroom</span>
            </div>
            <div className="materials-hero-rail-value">{classroomCount}</div>
          </div>
          <div className="materials-hero-rail-card links">
            <div className="materials-hero-rail-icon"><i className="fa-solid fa-link"></i></div>
            <div className="materials-hero-rail-copy">
              <strong>Links</strong>
              <span>Links & Videos</span>
            </div>
            <div className="materials-hero-rail-value">{linkCount}</div>
          </div>
        </div>
      </section>

      <section className="materials-stats-grid">
        <article className="materials-stat-card total glass-card">
          <div className="materials-stat-top">
            <div className="materials-stat-ring total">
              <div className="materials-stat-ring-core"><i className="fa-solid fa-folder-open"></i></div>
            </div>
            <span className="materials-stat-badge">Resource feed</span>
          </div>
          <strong>{materials.length}</strong>
          <div className="materials-stat-title">Total Materials</div>
        </article>

        <article className="materials-stat-card pdf glass-card">
          <div className="materials-stat-top">
            <div className="materials-stat-ring pdf">
              <div className="materials-stat-ring-core"><i className="fa-solid fa-file-pdf"></i></div>
            </div>
            <span className="materials-stat-badge">Documents</span>
          </div>
          <strong>{pdfCount}</strong>
          <div className="materials-stat-title">PDF Resources</div>
        </article>

        <article className="materials-stat-card link glass-card">
          <div className="materials-stat-top">
            <div className="materials-stat-ring link">
              <div className="materials-stat-ring-core"><i className="fa-solid fa-link"></i></div>
            </div>
            <span className="materials-stat-badge">External</span>
          </div>
          <strong>{linkCount}</strong>
          <div className="materials-stat-title">Links & Videos</div>
        </article>
      </section>

      <section className="materials-library-shell glass-panel panel-accent">
        <div className="materials-library-ambient ambient-left"></div>
        <div className="materials-library-ambient ambient-right"></div>
        <div className="materials-library-header">
          <div className="materials-library-title-wrap">
            <div className="materials-library-title-icon">
              <i className="fa-solid fa-book-open-reader"></i>
            </div>
            <div>
              <h2 className="materials-library-title">Resource Library</h2>
              <p className="materials-library-count">{visibleMaterials.length} of {materials.length} items visible</p>
            </div>
          </div>
          <button className="btn btn-outline materials-library-refresh" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Syncing</> : <><i className="fa-solid fa-rotate"></i> Refresh</>}
          </button>
        </div>

        <div className="materials-library-divider"></div>

        <div className="materials-filter-grid">
          <div className="materials-filter-group glass-pill-group">
            <span className="materials-filter-label">Source</span>
            <div className="materials-filter-controls">
              {SOURCE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${sourceFilter === filter ? 'active' : ''}`} onClick={() => setSourceFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="materials-filter-group glass-pill-group">
            <span className="materials-filter-label">Resource Type</span>
            <div className="materials-filter-controls">
              {TYPE_FILTERS.map((filter) => (
                <button key={filter} className={`filter-btn glass-filter-pill ${typeFilter === filter ? 'active' : ''}`} onClick={() => setTypeFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="materials-library-grid">
          {visibleMaterials.length === 0 && (
            <div className="materials-empty-state">
              <div className="materials-empty-particle particle-a"></div>
              <div className="materials-empty-particle particle-b"></div>
              <div className="materials-empty-visual">
                <div className="materials-empty-paper layer-back"></div>
                <div className="materials-empty-paper layer-mid"></div>
                <div className="materials-empty-paper layer-front"><i className="fa-solid fa-folder-open"></i></div>
              </div>
              <div className="materials-empty-copy">
                <h3>{materials.length === 0 ? 'No materials found' : 'No items match your filters'}</h3>
                <p>
                  {materials.length === 0
                    ? 'Lecture notes, PDFs, slides, and study resources will appear here once connected.'
                    : 'Try adjusting the source or resource type filters.'}
                </p>
              </div>
            </div>
          )}

          {visibleMaterials.length > 0 ? visibleMaterials.map((material) => {
            const sourceMeta = getSourceMeta(material);
            const materialTone = material.materialType.toLowerCase();
            return (
              <article className={`materials-resource-card ${materialTone}`} key={material.id}>
                <div className="materials-resource-accent"></div>
                <div className="materials-resource-preview">
                  <div className={`materials-resource-thumbnail ${materialTone}`}>
                    <div className="materials-resource-stack stack-back"></div>
                    <div className="materials-resource-stack stack-mid"></div>
                    <div className="materials-resource-stack stack-front">
                      <i className={`fa-solid ${getMaterialIcon(material.materialType)}`}></i>
                    </div>
                  </div>
                </div>

                <div className="materials-resource-body">
                  <div className="materials-resource-head">
                    <div className="materials-resource-meta">
                      <span className={`materials-resource-type ${materialTone}`}>{material.materialType}</span>
                      <span className={`materials-resource-source ${sourceMeta.tone}`}>
                        <i className={`${sourceMeta.iconFamily} ${sourceMeta.icon}`}></i>
                        {sourceMeta.label}
                      </span>
                      {material.course && <span className="materials-resource-course">{material.course}</span>}
                    </div>
                    <span className="materials-resource-time">{material.time}</span>
                  </div>

                  <h4 className="materials-resource-title">{material.title}</h4>
                  <p className="materials-resource-preview-copy">{material.preview}</p>

                  <div className="materials-resource-footer">
                    <div className="materials-resource-tags">
                      <span className="materials-resource-sender">{material.sender}</span>
                      {material.attachmentCount > 0 && (
                        <span className="materials-resource-attachments">
                          {material.attachmentCount} attachment{material.attachmentCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <div className="materials-resource-actions">
                      <span className="materials-resource-action"><i className="fa-solid fa-eye"></i> Preview</span>
                      <span className="materials-resource-action"><i className="fa-solid fa-arrow-up-right-from-square"></i> Open</span>
                    </div>
                  </div>

                  <div className="materials-resource-attachments-list">
                    <AttachmentList attachments={material.attachments} compact />
                  </div>
                </div>
              </article>
            );
          }) : null}
        </div>
      </section>
    </div>
  );
}