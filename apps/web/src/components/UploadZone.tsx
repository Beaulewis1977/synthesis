import { AlertCircle, CheckCircle, FileText, Upload, X } from 'lucide-react';
import { useState } from 'react';

interface UploadZoneProps {
  collectionId: string;
  onUploadComplete: () => void;
}

interface FileWithStatus {
  file: File;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

const ACCEPTED_TYPES = ['.pdf', '.docx', '.md', '.txt'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
    if (!ACCEPTED_TYPES.includes(ext)) {
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

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    const validFiles = files.filter((f) => f.status === 'pending');
    if (validFiles.length === 0) return;

    setIsUploading(true);

    // Mark files as uploading
    setFiles((prev) =>
      prev.map((f) => (f.status === 'pending' ? { ...f, status: 'uploading' } : f))
    );

    try {
      const formData = new FormData();
      formData.append('collection_id', collectionId);
      for (const f of validFiles) {
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

      // Mark all uploaded files as complete
      setFiles((prev) =>
        prev.map((f) => (f.status === 'uploading' ? { ...f, status: 'complete' } : f))
      );

      // Wait a moment to show success, then navigate back
      setTimeout(() => {
        onUploadComplete();
      }, 1000);
    } catch (error) {
      // Mark uploaded files as error
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
          transition-colors
          ${isDragging ? 'border-accent bg-blue-50' : 'border-border hover:border-accent'}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onClick={() => !isUploading && document.getElementById('file-input')?.click()}
      >
        <Upload className="mx-auto mb-md text-text-secondary" size={48} />
        <p className="text-lg font-medium mb-sm">Drag & Drop Files Here</p>
        <p className="text-sm text-text-secondary mb-md">or click to browse</p>
        <p className="text-xs text-text-secondary">
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
            {files.map((fileWithStatus, index) => (
              <div
                key={`${fileWithStatus.file.name}-${index}`}
                className="card p-md flex items-center gap-md"
              >
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
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                  className="btn btn-sm flex-shrink-0"
                  aria-label="Remove file"
                >
                  <X size={16} />
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
            className="btn btn-secondary"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={uploadFiles}
            disabled={validFileCount === 0 || isUploading}
            className="btn btn-primary"
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
