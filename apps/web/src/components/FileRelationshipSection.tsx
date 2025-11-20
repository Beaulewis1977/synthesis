import { useState } from 'react';
import { FileLink } from './FileLink';

interface FileRelationshipSectionProps {
  collectionId: string;
  title: string;
  files: string[];
  icon: string;
  ariaLabel: string;
}

export function FileRelationshipSection({
  collectionId,
  title,
  files,
  icon,
  ariaLabel,
}: FileRelationshipSectionProps) {
  const [expanded, setExpanded] = useState(files.length <= 3);
  const displayFiles = expanded ? files : files.slice(0, 3);

  return (
    <section aria-label={ariaLabel}>
      <h4 className="font-medium text-gray-700 mb-1 text-sm">
        {title} ({files.length})
      </h4>

      <ul className="ml-2 space-y-1" id={`file-list-${title.replace(/\s+/g, '-').toLowerCase()}`}>
        {displayFiles.map((file) => (
          <li key={file}>
            <FileLink collectionId={collectionId} filePath={file} icon={icon} />
          </li>
        ))}
      </ul>

      {files.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-blue-600 hover:underline text-xs mt-1 ml-2 focus:outline-none focus:ring-2 focus:ring-accent rounded px-1 min-h-[44px] flex items-center"
          aria-expanded={expanded}
          aria-controls={`file-list-${title.replace(/\s+/g, '-').toLowerCase()}`}
        >
          <span className="inline-block transition-transform" aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>{' '}
          {expanded ? 'Show less' : `Show ${files.length - 3} more`}
        </button>
      )}
    </section>
  );
}
