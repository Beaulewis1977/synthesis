import Anthropic from '@anthropic-ai/sdk';

export interface ContradictionSource {
  title: string | null;
  statement: string;
  quality?: string | null;
  date?: string | null;
  url?: string | null;
}

export interface ContradictionApproach {
  method: string;
  summary?: string | null;
  topic?: string | null;
  sources: ContradictionSource[];
  consensusScore?: number;
}

export interface Conflict {
  topic: string;
  source_a: ContradictionSource;
  source_b: ContradictionSource;
  severity: 'high' | 'medium' | 'low';
  difference: string;
  recommendation: string;
  confidence: number;
}

export interface DetectContradictionsOptions {
  signal?: AbortSignal;
  client?: Anthropic;
  maxPairs?: number;
}

const DEFAULT_MODEL = process.env.CONTRADICTION_MODEL ?? 'claude-3-haiku-20240307';
const DEFAULT_MAX_PAIRS = clampInt(process.env.CONTRADICTION_MAX_PAIRS, 6, 6);
const MIN_OVERLAP = clampFloat(process.env.CONTRADICTION_MIN_SIMILARITY, 1, 0.2);
const MAX_OVERLAP = clampFloat(process.env.CONTRADICTION_MAX_SIMILARITY, 1, 0.7);

let cachedClient: Anthropic | null = null;

export async function detectContradictions(
  approaches: ContradictionApproach[],
  options: DetectContradictionsOptions = {}
): Promise<Conflict[]> {
  if (!isDetectionEnabled() || approaches.length < 2) {
    return [];
  }

  const client = options.client ?? getClient();
  if (!client) {
    return [];
  }

  const maxPairs = Math.max(1, options.maxPairs ?? DEFAULT_MAX_PAIRS);
  const pairs = buildComparisonPairs(approaches, maxPairs);
  if (pairs.length === 0) {
    return [];
  }

  const conflicts: Conflict[] = [];
  for (const pair of pairs) {
    if (options.signal?.aborted) {
      break;
    }

    const conflict = await analyzePair(client, pair.a, pair.b, options.signal);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts;
}

function isDetectionEnabled(): boolean {
  const raw = process.env.ENABLE_CONTRADICTION_DETECTION ?? 'false';
  return raw.trim().toLowerCase() === 'true';
}

function getClient(): Anthropic | null {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

function buildComparisonPairs(
  approaches: ContradictionApproach[],
  maxPairs: number
): Array<{ a: ContradictionApproach; b: ContradictionApproach }> {
  const weighted: Array<{ a: ContradictionApproach; b: ContradictionApproach; weight: number }> =
    [];

  for (let i = 0; i < approaches.length - 1; i += 1) {
    for (let j = i + 1; j < approaches.length; j += 1) {
      const a = approaches[i];
      const b = approaches[j];
      const overlap = lexicalOverlap(
        a.summary ?? approachStatement(a),
        b.summary ?? approachStatement(b)
      );

      if (overlap < MIN_OVERLAP || overlap > MAX_OVERLAP) {
        continue;
      }

      const consensusGap = Math.abs((a.consensusScore ?? 0.5) - (b.consensusScore ?? 0.5));
      weighted.push({ a, b, weight: overlap + consensusGap });
    }
  }

  return weighted
    .sort((left, right) => right.weight - left.weight)
    .slice(0, maxPairs)
    .map(({ a, b }) => ({ a, b }));
}

async function analyzePair(
  client: Anthropic,
  a: ContradictionApproach,
  b: ContradictionApproach,
  signal?: AbortSignal
): Promise<Conflict | null> {
  const sourceA = selectPrimarySource(a);
  const sourceB = selectPrimarySource(b);
  const payload = buildPromptPayload(a, b, sourceA, sourceB);

  try {
    const response = await client.messages.create(
      {
        model: DEFAULT_MODEL,
        max_tokens: 400,
        temperature: 0,
        system:
          'You are a neutral technical editor. Compare two documentation approaches, identify contradictions, and respond with strict JSON.',
        messages: [
          {
            role: 'user',
            content: payload,
          },
        ],
      },
      signal ? { signal } : undefined
    );

    const content = extractTextContent(response);
    if (!content) {
      return null;
    }

    const parsed = safeJsonParse(content);
    if (!parsed || parsed.contradiction !== true) {
      return null;
    }

    const topicValue =
      typeof parsed.topic === 'string' ? parsed.topic : (a.topic ?? b.topic ?? a.method);
    const differenceValue =
      typeof parsed.difference === 'string' ? parsed.difference : 'Contradiction detected.';
    const recommendationValue =
      typeof parsed.recommendation === 'string'
        ? parsed.recommendation
        : 'Prefer the more recent or higher quality source.';

    return {
      topic: topicValue,
      source_a: sourceA,
      source_b: sourceB,
      severity: normalizeSeverity(parsed.severity),
      difference: differenceValue,
      recommendation: recommendationValue,
      confidence: clampFloat(parsed.confidence, 1, 0.6),
    };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw error;
    }
    return null;
  }
}

function approachStatement(approach: ContradictionApproach): string {
  if (approach.summary && approach.summary.trim().length > 0) {
    return approach.summary;
  }
  const primary = selectPrimarySource(approach);
  return primary.statement;
}

function selectPrimarySource(approach: ContradictionApproach): ContradictionSource {
  const [first] = approach.sources;
  if (!first) {
    return {
      title: approach.method,
      statement: approach.summary ?? approach.method,
    };
  }

  if (approach.summary && approach.summary.length <= 400) {
    return {
      ...first,
      statement: approach.summary,
    };
  }

  return {
    ...first,
    statement: first.statement || approach.summary || approach.method,
  };
}

function buildPromptPayload(
  a: ContradictionApproach,
  b: ContradictionApproach,
  sourceA: ContradictionSource,
  sourceB: ContradictionSource
): string {
  const input = {
    approach_a: {
      method: a.method,
      topic: a.topic ?? null,
      summary: approachStatement(a),
      quality: sourceA.quality ?? null,
      date: sourceA.date ?? null,
    },
    approach_b: {
      method: b.method,
      topic: b.topic ?? null,
      summary: approachStatement(b),
      quality: sourceB.quality ?? null,
      date: sourceB.date ?? null,
    },
  };

  return [
    'Compare the following approaches. Respond with JSON matching this schema:',
    '{',
    '  "contradiction": boolean,',
    '  "topic": string | null,',
    '  "difference": string,',
    '  "severity": "high" | "medium" | "low",',
    '  "recommendation": string,',
    '  "confidence": number',
    '}',
    'If there is no contradiction, respond with {"contradiction": false}.',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n');
}

function extractTextContent(
  response: Awaited<ReturnType<Anthropic['messages']['create']>>
): string {
  if (!response) {
    return '';
  }

  const candidate = (response as { content?: unknown }).content;
  if (!Array.isArray(candidate)) {
    return '';
  }

  const parts: string[] = [];
  for (const block of candidate as Array<{ type?: string; text?: string }>) {
    if (block && block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }

  return parts.join('\n').trim();
}

function safeJsonParse(value: string): Record<string, unknown> | null {
  try {
    const trimmed = value.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeSeverity(value: unknown): 'high' | 'medium' | 'low' {
  switch (typeof value === 'string' ? value.toLowerCase() : '') {
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

function clampFloat(value: unknown, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(max, Math.max(0, parsed));
}

function clampInt(value: unknown, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, parsed);
}

function lexicalOverlap(a: string, b: string): number {
  const termsA = tokenize(a);
  const termsB = tokenize(b);
  if (!termsA.size || !termsB.size) {
    return 0;
  }

  let intersection = 0;
  for (const term of termsA) {
    if (termsB.has(term)) {
      intersection += 1;
    }
  }

  const union = new Set([...termsA, ...termsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter(Boolean)
  );
}
