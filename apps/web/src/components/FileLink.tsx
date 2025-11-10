import { useNavigate } from 'react-router-dom';

interface FileLinkProps {
  collectionId: string;
  filePath: string;
  icon: string;
}

export function FileLink({ collectionId, filePath, icon }: FileLinkProps) {
  const navigate = useNavigate();
  const fileName = filePath.split('/').pop() || filePath;
  const directory = filePath.substring(0, filePath.lastIndexOf('/'));

  const handleClick = () => {
    const query = `file:${fileName}`;
    const encodedCollectionId = encodeURIComponent(collectionId);
    const encodedQuery = encodeURIComponent(query);
    navigate(`/search/${encodedCollectionId}?q=${encodedQuery}`);
  };

  return (
    <div className="flex items-start gap-2 text-xs group">
      <span className="text-gray-400">{icon}</span>
      <button
        type="button"
        onClick={handleClick}
        className="text-blue-600 hover:underline text-left"
        title={filePath}
      >
        <span className="font-medium">{fileName}</span>
        {directory && <span className="text-gray-500 ml-1">in {directory}</span>}
      </button>
    </div>
  );
}
