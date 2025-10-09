import { Link, useParams } from 'react-router-dom';

export function CollectionView() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <div className="mb-lg">
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Collections
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Collection View</h1>
          <button type="button" className="btn btn-primary">
            Upload Documents
          </button>
        </div>
        <p className="text-text-secondary mt-sm">Collection ID: {id}</p>
      </div>

      {/* Placeholder for document list */}
      <div className="card">
        <p className="text-text-secondary">Document list will be displayed here</p>
      </div>
    </div>
  );
}
