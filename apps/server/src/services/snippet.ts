const DEFAULT_SNIPPET_LENGTH = Number.parseInt(process.env.SEARCH_SNIPPET_LENGTH ?? '', 10) || 320;

export function createSnippet(
  text: string | null | undefined,
  maxLength: number = DEFAULT_SNIPPET_LENGTH
): string {
  if (!text) {
    return '';
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const safeLength = Math.max(0, maxLength - 1);
  return `${normalized.slice(0, safeLength)}…`;
}

export function getDefaultSnippetLength(): number {
  return DEFAULT_SNIPPET_LENGTH;
}
