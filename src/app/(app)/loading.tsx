// Shown instantly on navigation while the server renders the next page.
export default function Loading() {
  return <div className="page-loading" role="status" aria-label="Laster inn">
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-line" />
    <div className="grid-4" style={{marginTop:26}}>{[0,1,2,3].map((item) => <div key={item} className="skeleton skeleton-card" />)}</div>
    <div className="skeleton skeleton-panel" />
  </div>;
}
