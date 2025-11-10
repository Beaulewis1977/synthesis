import { useState } from 'react';
import { FileLink } from './FileLink';

interface FileRelationshipSectionProps {
  collectionId: string;
  title: string;
  files: string[];
  icon: string;
}

export function FileRelationshipSection({
  collectionId,
  title,
  files,
  icon,
}: FileRelationshipSectionProps) {
  const [expanded, setExpanded] = useState(files.length <= 3);
  const displayFiles = expanded ? files : files.slice(0, 3);

  return (
    <div>
      <div className="font-medium text-gray-700 mb-1">
        {title} ({files.length})
      </div>

      <div className="ml-2 space-y-1">
        {displayFiles.map((file) => (
          <FileLink key={file} collectionId={collectionId} filePath={file} icon={icon} />
        ))}

        {files.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:underline text-xs"
          >
            {expanded ? '▲ Show less' : `▼ Show ${files.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
}
