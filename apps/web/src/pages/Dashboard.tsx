export function Dashboard() {
  return (
    <div>
      <div className="mb-lg">
        <h1 className="text-2xl font-bold text-text-primary mb-md">Your Collections</h1>
        <p className="text-text-secondary">Dashboard page - Collections will be displayed here</p>
      </div>

      {/* Placeholder for collection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
        <div className="card">
          <h3 className="text-lg font-semibold mb-sm">Placeholder Collection</h3>
          <p className="text-text-secondary text-sm mb-md">📄 0 documents</p>
          <div className="flex gap-sm">
            <button type="button" className="btn btn-secondary text-sm">
              View
            </button>
            <button type="button" className="btn btn-primary text-sm">
              Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
