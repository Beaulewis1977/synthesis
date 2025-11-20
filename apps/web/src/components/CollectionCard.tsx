import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../lib/utils';
import type { Collection } from '../types';

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const navigate = useNavigate();

  const handleView = () => {
    navigate(`/collections/${collection.id}`);
  };

  const handleChat = () => {
    navigate(`/chat/${collection.id}`);
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-text-primary mb-sm">{collection.name}</h3>

      {collection.description && (
        <p className="text-text-secondary text-sm mb-md line-clamp-2">{collection.description}</p>
      )}

      <p className="text-text-secondary text-sm mb-md">
        Updated {formatRelativeTime(collection.updated_at)}
      </p>

      <div className="flex gap-sm">
        <button type="button" onClick={handleView} className="btn btn-secondary text-sm flex-1">
          View
        </button>
        <button type="button" onClick={handleChat} className="btn btn-primary text-sm flex-1">
          Chat
        </button>
      </div>
    </div>
  );
}
