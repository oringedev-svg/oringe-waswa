// Shown instantly on every navigation between top-level routes, so a page
// change gives immediate feedback instead of a frozen screen while the next
// route's data loads (or, in dev, while it compiles). A thin top progress
// bar rather than a full-screen spinner, so it never feels heavier than the
// page it is standing in for.
export default function Loading() {
  return (
    <div className="route-progress" aria-label="Loading" role="status">
      <span className="route-progress-bar" />
    </div>
  )
}
