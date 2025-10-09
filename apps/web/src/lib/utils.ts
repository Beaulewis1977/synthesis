// Utility functions for formatting and display

import { formatDistanceToNow } from 'date-fns';
import { FileCode, FileIcon, FileText } from 'lucide-react';

/**
 * Format file size in bytes to human-readable format
 * Accepts both number and string (API returns string)
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
 * Format date to relative time (e.g., "2 days ago")
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
 * Get the appropriate icon component for a file type
 */
export function getFileTypeIcon(contentType: string): typeof FileIcon {
  if (contentType.includes('pdf')) {
    return FileText;
  }
  if (contentType.includes('word') || contentType.includes('document')) {
    return FileText;
  }
  if (contentType.includes('markdown') || contentType.includes('text')) {
    return FileCode;
  }
  return FileIcon;
}

/**
 * Get a user-friendly label for content type
 */
export function getFileTypeLabel(contentType: string): string {
  if (contentType.includes('pdf')) return 'PDF';
  if (contentType.includes('word') || contentType.includes('document')) return 'DOCX';
  if (contentType.includes('markdown')) return 'MD';
  if (contentType.includes('text')) return 'TXT';
  return 'File';
}
