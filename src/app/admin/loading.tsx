// Admin-specific loading state: a small card-shaped skeleton so switching
// between admin tools shows structure immediately rather than a blank pane.
export default function AdminLoading() {
  return (
    <div className="admin-main">
      <div className="route-progress" role="status" aria-label="Loading">
        <span className="route-progress-bar" />
      </div>
      <div className="skeleton" style={{ height: '2rem', width: '14rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '7rem', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    </div>
  )
}
