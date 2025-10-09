import { formatDistanceToNow } from 'date-fns';
import { FileCode, FileIcon, FileText } from 'lucide-react';

/**
 * Format a byte size into a human-readable string.
 * @param bytes Size value expressed as a number or numeric string.
 */
export function formatFileSize(bytes: number | string): string {
  const numBytes = typeof bytes === 'string' ? Number.parseInt(bytes, 10) : bytes;

  if (numBytes === 0 || Number.isNaN(numBytes)) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(numBytes) / Math.log(k));

  return `${(numBytes / k ** i).toFixed(1)} ${units[i]}`;
}

/**
 * Format a date into relative time (e.g., "2 days ago").
 * @param date A Date or ISO string to format.
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

/**
 * Choose the appropriate icon component for a file content type.
 * @param contentType MIME type string reported by the API.
 */
export function getFileTypeIcon(contentType: string): typeof FileIcon {
  const normalized = contentType.toLowerCase();

  if (normalized.includes('pdf')) {
    return FileText;
  }
  if (normalized.includes('word') || normalized.includes('document')) {
    return FileText;
  }
  if (normalized.includes('markdown') || normalized.includes('text')) {
    return FileCode;
  }
  return FileIcon;
}

/**
 * Map a MIME content type to a user-friendly label.
 * @param contentType MIME type string reported by the API.
 */
export function getFileTypeLabel(contentType: string): string {
  const normalized = contentType.toLowerCase();

  if (normalized.includes('pdf')) return 'PDF';
  if (normalized.includes('word') || normalized.includes('document')) return 'DOCX';
  if (normalized.includes('markdown')) return 'MD';
  if (normalized.includes('text')) return 'TXT';
  return 'File';
}
