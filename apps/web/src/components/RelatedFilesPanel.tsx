import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { FileRelationshipSection } from './FileRelationshipSection';

interface RelatedFilesPanelProps {
  collectionId: string;
  docId: string;
}

export function RelatedFilesPanel({ collectionId, docId }: RelatedFilesPanelProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['related-files', docId],
    queryFn: () => apiClient.getRelatedFiles(docId),
  });

  if (isLoading) {
    return (
      <output className="text-sm text-gray-500 mt-2 animate-pulse" aria-live="polite">
        Loading related files...
      </output>
    );
  }

  if (isError || !data?.related_files) {
    return (
      <div className="text-sm text-gray-500 mt-2 text-center py-2">
        <p>No related files found</p>
      </div>
    );
  }

  const { related_files } = data;
  const hasAnyRelationships =
    related_files.imports?.length > 0 ||
    related_files.imported_by?.length > 0 ||
    related_files.uses?.length > 0 ||
    related_files.used_by?.length > 0 ||
    related_files.tests?.length > 0 ||
    related_files.siblings?.length > 0;

  if (!hasAnyRelationships) {
    return (
      <div className="text-sm text-gray-500 mt-2 text-center py-2">
        <p>No related files found</p>
      </div>
    );
  }

  return (
    <nav
      className="mt-sm p-sm bg-gray-50 rounded border border-gray-200 text-sm animate-slide-down"
      aria-label="Related files"
    >
      <div className="space-y-sm">
        {related_files.imports && related_files.imports.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="📦 Imports"
            files={related_files.imports}
            icon="→"
            ariaLabel="Files imported by this file"
          />
        )}

        {related_files.imported_by && related_files.imported_by.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="🔗 Imported By"
            files={related_files.imported_by}
            icon="←"
            ariaLabel="Files that import this file"
          />
        )}

        {related_files.uses && related_files.uses.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="⚙️ Uses"
            files={related_files.uses}
            icon="⇢"
            ariaLabel="Dependencies used by this file"
          />
        )}

        {related_files.used_by && related_files.used_by.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="🧭 Used By"
            files={related_files.used_by}
            icon="⇠"
            ariaLabel="Files that depend on this file"
          />
        )}

        {related_files.tests && related_files.tests.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="📝 Tests"
            files={related_files.tests}
            icon="✓"
            ariaLabel="Test files for this file"
          />
        )}

        {related_files.siblings && related_files.siblings.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="👥 Sibling Files"
            files={related_files.siblings.slice(0, 5)}
            icon="•"
            ariaLabel="Related files in the same directory"
          />
        )}
      </div>
    </nav>
  );
}
