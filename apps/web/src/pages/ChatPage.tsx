import { Link, useParams } from 'react-router-dom';

export function ChatPage() {
  const { collectionId } = useParams<{ collectionId: string }>();

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="mb-lg">
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Collections
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Chat Interface</h1>
        <p className="text-text-secondary mt-sm">Collection ID: {collectionId}</p>
      </div>

      {/* Placeholder for chat interface */}
      <div className="flex-1 card flex flex-col">
        <div className="flex-1 overflow-y-auto mb-md">
          <p className="text-text-secondary">Chat messages will be displayed here</p>
        </div>
        <div className="border-t border-border pt-md">
          <div className="flex gap-sm">
            <input
              type="text"
              placeholder="Type your message..."
              className="input flex-1"
              disabled
            />
            <button type="button" className="btn btn-primary">
              Send →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
