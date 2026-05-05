function SkeletonBanner() {
  return <div className="skeleton skeleton-banner" />;
}

function SkeletonStatsGrid() {
  return (
    <div className="skeleton-stats-grid">
      <div className="skeleton skeleton-stat-card" />
      <div className="skeleton skeleton-stat-card" />
      <div className="skeleton skeleton-stat-card" />
    </div>
  );
}

function SkeletonListPanel({ rows = 5 }) {
  return (
    <div className="skeleton-panel">
      <div className="skeleton skeleton-panel-header" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

function SkeletonCardPanel({ cards = 6 }) {
  return (
    <div className="skeleton-panel">
      <div className="skeleton skeleton-panel-header" />
      <div className="skeleton-card-grid">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="dashboard-scroll">
      <SkeletonBanner />
      <SkeletonStatsGrid />
      <div className="skeleton-content-grid">
        <SkeletonListPanel rows={3} />
        <SkeletonListPanel rows={5} />
      </div>
    </div>
  );
}

function SkeletonListPage() {
  return (
    <div className="dashboard-scroll">
      <SkeletonBanner />
      <SkeletonStatsGrid />
      <SkeletonListPanel rows={6} />
    </div>
  );
}

function SkeletonCardPage() {
  return (
    <div className="dashboard-scroll">
      <SkeletonBanner />
      <SkeletonStatsGrid />
      <SkeletonCardPanel cards={6} />
    </div>
  );
}

export default function PageSkeleton({ variant = 'list' }) {
  if (variant === 'dashboard') return <SkeletonDashboard />;
  if (variant === 'cards') return <SkeletonCardPage />;
  return <SkeletonListPage />;
}
