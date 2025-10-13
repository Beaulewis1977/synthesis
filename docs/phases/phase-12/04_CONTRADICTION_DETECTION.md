# Phase 12: Contradiction Detection

**LLM-powered conflict identification between documentation sources**

---

## 🎯 Purpose

Automatically detect contradictions between different documentation sources to:
1. **Identify outdated information** (old vs new recommendations)
2. **Highlight conflicting approaches** (different methodologies)
3. **Categorize severity** (high/medium/low impact)
4. **Provide recommendations** (which source to trust)
5. **Build trust** (users see we acknowledge conflicts)

---

## 🏗️ Architecture

### Detection Pipeline

```
Approaches from Synthesis Engine
  ↓
Pairwise Comparison
  - Compare approach A vs approach B
  - Extract key statements
  - Calculate semantic similarity
  ↓
Conflict Candidates (similarity < 0.4)
  ↓
LLM Verification
  - Send to Claude/GPT for analysis
  - Ask: "Are these contradictory?"
  - Get structured response
  ↓
Severity Classification
  - High: Incompatible approaches
  - Medium: Different but valid
  - Low: Minor preference differences
  ↓
Recommendation Generation
  - Prefer official sources
  - Prefer recent content
  - Explain reasoning
  ↓
Conflict Objects
  [{
    topic: "state management",
    source_a: {...},
    source_b: {...},
    severity: "medium",
    difference: "...",
    recommendation: "Use source_b (newer)"
  }]
```

---

## 📦 Implementation

### Core Detection Function

**File:** `apps/server/src/services/contradiction-detection.ts`

```typescript
import type { Approach } from './synthesis.js';
import { Anthropic } from '@anthropic-ai/sdk';

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Conflict {
  topic: string;
  source_a: {
    title: string;
    statement: string;
    quality: string;
    date?: string;
  };
  source_b: {
    title: string;
    statement: string;
    quality: string;
    date?: string;
  };
  severity: 'high' | 'medium' | 'low';
  difference: string;
  recommendation: string;
  confidence: number;
}

/**
 * Detect contradictions between approaches
 */
export async function detectContradictions(
  approaches: Approach[]
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  
  // Pairwise comparison
  for (let i = 0; i < approaches.length; i++) {
    for (let j = i + 1; j < approaches.length; j++) {
      const conflict = await compareApproaches(
        approaches[i],
        approaches[j]
      );
      
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }
  
  return conflicts;
}

/**
 * Compare two approaches for contradictions
 */
async function compareApproaches(
  approachA: Approach,
  approachB: Approach
): Promise<Conflict | null> {
  // 1. Quick semantic similarity check
  const similarity = calculateSimilarity(approachA, approachB);
  
  // If too similar, they agree (not contradictory)
  if (similarity > 0.7) {
    return null;
  }
  
  // If too different, they're about different topics (not contradictory)
  if (similarity < 0.2) {
    return null;
  }
  
  // 2. LLM verification for potential conflicts (0.2 - 0.7 similarity)
  const conflict = await verifyContradictionWithLLM(approachA, approachB);
  
  return conflict;
}

/**
 * Use LLM to verify if approaches contradict
 */
async function verifyContradictionWithLLM(
  approachA: Approach,
  approachB: Approach
): Promise<Conflict | null> {
  const sourceA = approachA.sources[0];
  const sourceB = approachB.sources[0];
  
  const prompt = `
Analyze these two documentation sources and determine if they contradict each other.

Source A (${sourceA.metadata?.source_quality || 'unknown'}):
Title: ${sourceA.docTitle}
Date: ${sourceA.metadata?.last_verified || 'unknown'}
Content: ${approachA.summary}

Source B (${sourceB.metadata?.source_quality || 'unknown'}):
Title: ${sourceB.docTitle}
Date: ${sourceB.metadata?.last_verified || 'unknown'}
Content: ${approachB.summary}

Questions:
1. Are these sources contradictory? (true/false)
2. If yes, what is the key difference?
3. What is the severity? (high: incompatible, medium: different approaches, low: minor preference)
4. Which should be preferred and why?
5. How confident are you? (0-1)

Respond ONLY with valid JSON in this exact format:
{
  "contradictory": boolean,
  "difference": "string explaining the contradiction",
  "severity": "high" | "medium" | "low",
  "prefer": "source_a" | "source_b" | "neither",
  "reasoning": "string explaining recommendation",
  "confidence": number
}
`;

  try {
    const response = await claude.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });
    
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }
    
    const analysis = JSON.parse(content.text);
    
    if (!analysis.contradictory) {
      return null; // Not contradictory
    }
    
    // Build conflict object
    const conflict: Conflict = {
      topic: extractCommonTopic(approachA, approachB),
      source_a: {
        title: sourceA.docTitle,
        statement: approachA.summary,
        quality: sourceA.metadata?.source_quality || 'unknown',
        date: sourceA.metadata?.last_verified,
      },
      source_b: {
        title: sourceB.docTitle,
        statement: approachB.summary,
        quality: sourceB.metadata?.source_quality || 'unknown',
        date: sourceB.metadata?.last_verified,
      },
      severity: analysis.severity,
      difference: analysis.difference,
      recommendation: buildRecommendation(
        analysis.prefer,
        analysis.reasoning,
        sourceA,
        sourceB
      ),
      confidence: analysis.confidence,
    };
    
    return conflict;
  } catch (error) {
    console.error('LLM contradiction detection failed:', error);
    return null; // Fail gracefully
  }
}

/**
 * Calculate semantic similarity (placeholder)
 */
function calculateSimilarity(
  approachA: Approach,
  approachB: Approach
): number {
  // In real implementation, use embeddings
  // For now, simple heuristic based on method names
  const methodA = approachA.method.toLowerCase();
  const methodB = approachB.method.toLowerCase();
  
  if (methodA === methodB) return 1.0;
  if (methodA.includes(methodB) || methodB.includes(methodA)) return 0.8;
  
  // Check for common words
  const wordsA = new Set(methodA.split(/\s+/));
  const wordsB = new Set(methodB.split(/\s+/));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return intersection.size / union.size;
}

/**
 * Extract common topic between two approaches
 */
function extractCommonTopic(
  approachA: Approach,
  approachB: Approach
): string {
  // Simple implementation: use first approach's method
  return approachA.method;
}

/**
 * Build human-readable recommendation
 */
function buildRecommendation(
  prefer: 'source_a' | 'source_b' | 'neither',
  reasoning: string,
  sourceA: any,
  sourceB: any
): string {
  if (prefer === 'neither') {
    return `Both approaches are valid. ${reasoning}`;
  }
  
  const preferredSource = prefer === 'source_a' ? sourceA : sourceB;
  const quality = preferredSource.metadata?.source_quality;
  const date = preferredSource.metadata?.last_verified;
  
  let recommendation = `Prefer ${preferredSource.docTitle}`;
  
  if (quality === 'official') {
    recommendation += ' (official documentation)';
  } else if (date) {
    const dateObj = new Date(date);
    const isRecent = Date.now() - dateObj.getTime() < 180 * 24 * 60 * 60 * 1000;
    if (isRecent) {
      recommendation += ' (more recent)';
    }
  }
  
  recommendation += `. ${reasoning}`;
  
  return recommendation;
}
```

---

## 🧪 Example Scenarios

### Scenario 1: Outdated vs Current

**Input:**
```typescript
{
  approachA: {
    method: "Provider pattern",
    sources: [{
      docTitle: "Flutter State Management 2020",
      metadata: { 
        source_quality: "official",
        last_verified: "2020-03-01"
      }
    }],
    summary: "Use Provider for state management in Flutter apps..."
  },
  approachB: {
    method: "Riverpod",
    sources: [{
      docTitle: "Flutter State Management 2024",
      metadata: { 
        source_quality: "official",
        last_verified: "2024-10-01"
      }
    }],
    summary: "Riverpod is now recommended over Provider..."
  }
}
```

**Output:**
```typescript
{
  topic: "state management",
  source_a: {
    title: "Flutter State Management 2020",
    statement: "Use Provider for state management...",
    quality: "official",
    date: "2020-03-01"
  },
  source_b: {
    title: "Flutter State Management 2024",
    statement: "Riverpod is now recommended...",
    quality: "official",
    date: "2024-10-01"
  },
  severity: "medium",
  difference: "Provider was previously recommended, but Riverpod is now the official recommendation",
  recommendation: "Prefer Flutter State Management 2024 (more recent). Riverpod offers better performance and type safety.",
  confidence: 0.95
}
```

### Scenario 2: Different but Valid

**Input:**
```typescript
{
  approachA: {
    method: "Firebase Auth",
    summary: "Firebase Authentication provides OAuth, email/password..."
  },
  approachB: {
    method: "Supabase Auth",
    summary: "Supabase Auth integrates with PostgreSQL..."
  }
}
```

**Output:**
```typescript
{
  severity: "low",
  difference: "Different authentication providers for different use cases",
  recommendation: "Both approaches are valid. Choose based on your backend infrastructure.",
  confidence: 0.85
}
```

---

## 🔧 Testing

### Unit Tests

```typescript
describe('Contradiction Detection', () => {
  it('detects version-based contradictions', async () => {
    const approaches = [
      {
        method: 'Provider',
        sources: [{ 
          docTitle: 'Old Docs',
          metadata: { last_verified: '2020-01-01' }
        }],
        summary: 'Use Provider'
      },
      {
        method: 'Riverpod',
        sources: [{ 
          docTitle: 'New Docs',
          metadata: { last_verified: '2024-01-01' }
        }],
        summary: 'Use Riverpod instead'
      }
    ];
    
    const conflicts = await detectContradictions(approaches);
    
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('medium');
  });
  
  it('ignores non-contradictory approaches', async () => {
    const approaches = [
      { method: 'Firebase', summary: 'Firebase auth...' },
      { method: 'Supabase', summary: 'Supabase auth...' }
    ];
    
    const conflicts = await detectContradictions(approaches);
    
    expect(conflicts.length).toBeLessThanOrEqual(1);
    if (conflicts.length > 0) {
      expect(conflicts[0].severity).toBe('low');
    }
  });
});
```

---

## 💰 Cost Management

**LLM API Costs:**
- Model: Claude 3 Haiku (cheapest)
- Cost: ~$0.25 per 1M input tokens
- Average prompt: ~500 tokens
- Average response: ~200 tokens
- Cost per comparison: ~$0.0002

**Typical Usage:**
- 3 approaches = 3 comparisons
- 100 synthesis requests/month
- 300 comparisons × $0.0002 = **$0.06/month**

**Optimization:**
- Cache common contradictions
- Skip if similarity too high/low
- Batch multiple comparisons

---

## ⚙️ Configuration

```bash
# .env
ANTHROPIC_API_KEY=<your-key>
ENABLE_CONTRADICTION_DETECTION=true
CONTRADICTION_CACHE_TTL=86400  # 24 hours
CONTRADICTION_MIN_SIMILARITY=0.2
CONTRADICTION_MAX_SIMILARITY=0.7
```

---

## ✅ Acceptance Criteria

- [ ] Detects contradictions between outdated and current docs
- [ ] Categorizes severity accurately (high/medium/low)
- [ ] Provides actionable recommendations
- [ ] Confidence scores reflect accuracy
- [ ] Handles LLM API errors gracefully
- [ ] Cost <$0.10/month for typical usage
- [ ] Response time <1 second per comparison
- [ ] Cache prevents redundant LLM calls

---

**Next:** See `05_COST_MONITORING.md` for API usage tracking
