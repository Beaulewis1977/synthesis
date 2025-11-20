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
      <span className="text-gray-400 flex-shrink-0" aria-hidden="true">
        {icon}
      </span>
      <button
        type="button"
        onClick={handleClick}
        className="text-blue-600 hover:underline text-left cursor-pointer min-w-0 flex-1 focus:outline-none focus:ring-2 focus:ring-accent rounded px-1 -mx-1 min-h-[44px] flex items-center"
        title={`Search for ${filePath}`}
        aria-label={`Search for file ${fileName}`}
      >
        <span className="font-medium break-all">{fileName}</span>
        {directory && (
          <span className="text-gray-500 ml-1 break-all">
            in <span className="truncate inline-block max-w-full align-bottom">{directory}</span>
          </span>
        )}
      </button>
    </div>
  );
}
