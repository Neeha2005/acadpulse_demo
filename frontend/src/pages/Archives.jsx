import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';

const CATEGORIES = ['All', 'assignment', 'quiz', 'announcement', 'material', 'event', 'exam_schedule'];

function previewText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > 170 ? `${text.slice(0, 167)}...` : text;
}

function formatDate(value) {
  if (!value) return 'No deadline';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No deadline';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Archives() {
  const { apiFetch, authUser } = useAppContext();
  const [archives, setArchives] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openGroups, setOpenGroups] = useState({});

  const loadArchives = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (authUser?.id) params.set('user_id', authUser.id);
      if (category !== 'All') params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      const payload = await apiFetch(`/archives?${params.toString()}`, {}, false);
      const rows = Array.isArray(payload?.archives) ? payload.archives : [];
      setArchives(rows);
      setOpenGroups((current) => {
        if (Object.keys(current).length) return current;
        const firstLabel = rows[0]?.semester_label;
        return firstLabel ? { [firstLabel]: true } : {};
      });
    } catch (archiveError) {
      setError(archiveError.message || 'Unable to load archives.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, category, search]);

  useEffect(() => {
    const timer = window.setTimeout(loadArchives, 120);
    return () => window.clearTimeout(timer);
  }, [loadArchives]);

  const groupedArchives = useMemo(() => {
    return archives.reduce((groups, item) => {
      const label = item.semester_label || 'Archived Semester';
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
      return groups;
    }, {});
  }, [archives]);

  return (
    <div className="dashboard-scroll">
      <section className="glass-banner archive-header">
        <div className="welcome-text">
          <span className="hero-kicker">HISTORY</span>
          <h1 className="hero-title">Past Semesters</h1>
          <p>Browse your academic history</p>
        </div>
      </section>

      <div className="panel glass-panel panel-accent archive-panel">
        <div className="archive-filter-bar">
          <div className="archive-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search archived text..."
            />
          </div>
          <div className="filters glass-pill-group">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={`filter-btn glass-filter-pill ${category === item ? 'active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {item === 'All' ? 'All' : item.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="archive-error">
            <i className="fa-solid fa-triangle-exclamation"></i> {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state glass-empty-state">
            <div className="empty-state-icon"><i className="fa-solid fa-circle-notch fa-spin"></i></div>
            <p>Loading archives...</p>
          </div>
        ) : archives.length === 0 ? (
          <div className="empty-state glass-empty-state archive-empty">
            <div className="empty-state-icon"><i className="fa-solid fa-folder-open"></i></div>
            <p>No archives yet — your first semester reset will appear here</p>
          </div>
        ) : (
          <div className="archive-accordion">
            {Object.entries(groupedArchives).map(([label, items]) => (
              <section className="archive-group" key={label}>
                <button
                  type="button"
                  className="archive-group-header"
                  onClick={() => setOpenGroups((current) => ({ ...current, [label]: !current[label] }))}
                >
                  <span>{label}</span>
                  <strong>{items.length} item{items.length === 1 ? '' : 's'}</strong>
                  <i className={`fa-solid fa-chevron-${openGroups[label] ? 'up' : 'down'}`}></i>
                </button>
                {openGroups[label] && (
                  <div className="archive-list">
                    {items.map((item) => (
                      <article className="archive-item" key={item.id}>
                        <div className="archive-badges">
                          <span className="archive-badge category">{(item.category || 'unknown').replace(/_/g, ' ')}</span>
                          <span className="archive-badge source">{item.source_type || 'source'}</span>
                        </div>
                        <p>{previewText(item.message_text)}</p>
                        <time>Original deadline: {formatDate(item.deadline)}</time>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
