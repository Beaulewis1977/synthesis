import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { FileRelationshipSection } from './FileRelationshipSection';

interface RelatedFilesPanelProps {
  collectionId: string;
  docId: string;
  filePath: string;
}

export function RelatedFilesPanel({ collectionId, docId }: RelatedFilesPanelProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['related-files', docId],
    queryFn: () => apiClient.getRelatedFiles(docId),
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500 mt-2">Loading related files...</div>;
  }

  if (isError || !data?.related_files) {
    return <div className="text-sm text-gray-500 mt-2">No related files found</div>;
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
    return <div className="text-sm text-gray-500 mt-2">No related files found</div>;
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 text-sm">
      <div className="space-y-3">
        {related_files.imports && related_files.imports.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="📦 Imports"
            files={related_files.imports}
            icon="→"
          />
        )}

        {related_files.imported_by && related_files.imported_by.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="🔗 Imported By"
            files={related_files.imported_by}
            icon="←"
          />
        )}

        {related_files.uses && related_files.uses.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="⚙️ Uses"
            files={related_files.uses}
            icon="⇢"
          />
        )}

        {related_files.used_by && related_files.used_by.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="🧭 Used By"
            files={related_files.used_by}
            icon="⇠"
          />
        )}

        {related_files.tests && related_files.tests.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="📝 Tests"
            files={related_files.tests}
            icon="✓"
          />
        )}

        {related_files.siblings && related_files.siblings.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="👥 Sibling Files"
            files={related_files.siblings.slice(0, 5)}
            icon="•"
          />
        )}
      </div>
    </div>
  );
}
