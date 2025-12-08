import { AlertCircle, CheckCircle, FileText, Upload, X } from 'lucide-react';
import { useState } from 'react';

interface UploadZoneProps {
  collectionId: string;
  onUploadComplete: () => void;
}

interface FileWithStatus {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

// File extensions for validation
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.txt'];
// MIME types + extensions for browser file picker compatibility
const ACCEPTED_TYPES = [
  '.pdf',
  'application/pdf',
  '.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md',
  'text/markdown',
  '.txt',
  'text/plain',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const createUploadId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isValidUploadResult = (
  input: unknown
): input is {
  filename: string;
  status: 'success' | 'error';
  uploadIndex?: number;
  error?: string;
} => {
  if (!input || typeof input !== 'object') return false;
  const candidate = input as Record<string, unknown>;
  const status = candidate.status;
  const hasValidStatus = status === 'success' || status === 'error';
  return (
    typeof candidate.filename === 'string' &&
    hasValidStatus &&
    (candidate.uploadIndex === undefined || typeof candidate.uploadIndex === 'number') &&
    (candidate.error === undefined || typeof candidate.error === 'string')
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ collectionId, onUploadComplete }: UploadZoneProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return 'Invalid file type. Accepted: PDF, DOCX, MD, TXT';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large (max 50MB)';
    }
    return null;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles = Array.from(fileList).map((file) => {
      const error = validateFile(file);
      return {
        id: createUploadId(),
        file,
        status: error ? ('error' as const) : ('pending' as const),
        error: error || undefined,
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const uploadFiles = async () => {
    const uploadTargets = files.filter((f) => f.status === 'pending');
    if (uploadTargets.length === 0) return;

    setIsUploading(true);

    const uploadOrder = uploadTargets.map((f) => f.id);
    const uploadIdSet = new Set(uploadOrder);

    // Mark files as uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' ? { ...f, status: 'uploading', error: undefined } : f
      )
    );

    try {
      const formData = new FormData();
      formData.append('collection_id', collectionId);
      for (const f of uploadTargets) {
        formData.append('files', f.file);
      }

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      const rawResults = Array.isArray(data?.results) ? data.results : null;
      if (!rawResults) {
        console.error('Invalid upload response shape', data);
      }

      // @ts-ignore - UploadResult vs generic object
      const validatedResults = rawResults?.filter(isValidUploadResult) ?? [];
      const normalizedResults = validatedResults.filter(
        (result: {
          uploadIndex?: number;
        }): result is (typeof validatedResults)[number] & {
          uploadIndex: number;
        } => typeof result.uploadIndex === 'number'
      );

      // If server returned results but without indices, and count matches, infer indices
      if (
        validatedResults.length > 0 &&
        normalizedResults.length === 0 &&
        validatedResults.length === uploadTargets.length
      ) {
        for (let index = 0; index < validatedResults.length; index++) {
          const result = validatedResults[index];
          normalizedResults.push({ ...result, uploadIndex: index });
        }
      } else if (validatedResults.length > 0 && normalizedResults.length === 0) {
        console.warn(
          'Upload results missing uploadIndex and count mismatch; cannot map results',
          validatedResults
        );
      }

      const resultById = new Map<string, (typeof normalizedResults)[number]>();
      for (const result of normalizedResults) {
        const targetId = uploadOrder[result.uploadIndex];
        if (targetId) {
          resultById.set(targetId, result);
        }
      }

      // Update files based on results
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== 'uploading') return f;

          const result = resultById.get(f.id);
          if (result) {
            return {
              ...f,
              status: result.status === 'success' ? 'complete' : 'error',
              error: result.status === 'error' ? result.error : undefined,
            };
          }

          if (uploadIdSet.has(f.id)) {
            return { ...f, status: 'error', error: 'no server result' };
          }

          return f;
        })
      );

      const hasFailures = uploadOrder.some((id) => {
        const result = resultById.get(id);
        return !result || result.status !== 'success';
      });

      // Wait a moment to show success, then navigate back if all succeeded
      if (!hasFailures) {
        setTimeout(() => {
          onUploadComplete();
        }, 1500);
      }
    } catch (error) {
      // Mark remaining uploading files as error
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'error', error: errorMessage } : f
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const validFileCount = files.filter((f) => f.status === 'pending').length;
  const hasFiles = files.length > 0;

  return (
    <div className="space-y-md">
      {/* Drop Zone */}
      <button
        type="button"
        tabIndex={0}
        aria-label="Upload files drop zone"
        aria-describedby="upload-instructions"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isUploading) {
            document.getElementById('file-input')?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-xl text-center cursor-pointer
          transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
          ${isDragging ? 'border-accent bg-blue-50' : 'border-border hover:border-accent'}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onClick={() => !isUploading && document.getElementById('file-input')?.click()}
      >
        <Upload className="mx-auto mb-md text-text-secondary" size={48} aria-hidden="true" />
        <p className="text-lg font-medium mb-sm">Drag & Drop Files Here</p>
        <p className="text-sm text-text-secondary mb-md">or click to browse</p>
        <p id="upload-instructions" className="text-xs text-text-secondary">
          Supported: PDF, DOCX, Markdown, TXT • Max size: 50 MB per file
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          aria-label="Choose files to upload"
        />
      </button>

      {/* Files List */}
      {hasFiles && (
        <div className="space-y-sm">
          <h3 className="font-semibold">
            Files Selected ({files.length})
            {files.length !== validFileCount && (
              <span className="text-text-secondary ml-sm text-sm font-normal">
                ({validFileCount} ready to upload)
              </span>
            )}
          </h3>

          <div className="space-y-sm">
            {files.map((fileWithStatus) => (
              <div key={fileWithStatus.id} className="card p-md flex items-center gap-md">
                <FileText className="text-accent flex-shrink-0" size={24} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-xs">
                    <p className="font-medium truncate">{fileWithStatus.file.name}</p>
                    <span className="text-sm text-text-secondary ml-md flex-shrink-0">
                      {formatFileSize(fileWithStatus.file.size)}
                    </span>
                  </div>

                  {fileWithStatus.status === 'pending' && (
                    <p className="text-sm text-text-secondary">Ready to upload</p>
                  )}

                  {fileWithStatus.status === 'uploading' && (
                    <p className="text-sm text-accent">Uploading...</p>
                  )}

                  {fileWithStatus.status === 'complete' && (
                    <div className="flex items-center gap-xs text-success text-sm">
                      <CheckCircle size={14} />
                      <span>Uploaded successfully</span>
                    </div>
                  )}

                  {fileWithStatus.status === 'error' && fileWithStatus.error && (
                    <div className="flex items-center gap-xs text-error text-sm">
                      <AlertCircle size={14} />
                      <span>{fileWithStatus.error}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(fileWithStatus.id)}
                  disabled={isUploading}
                  className="btn btn-sm flex-shrink-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  aria-label={`Remove ${fileWithStatus.file.name}`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {hasFiles && (
        <div className="flex justify-end gap-sm">
          <button
            type="button"
            onClick={() => setFiles([])}
            disabled={isUploading}
            className="btn btn-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={uploadFiles}
            disabled={validFileCount === 0 || isUploading}
            className="btn btn-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {isUploading
              ? 'Uploading...'
              : `Upload ${validFileCount} File${validFileCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
