# Phase 11: Trust Scoring System

**Metadata-based source quality assessment**

---

## 🎯 Overview

The trust scoring system automatically assesses and categorizes document sources into quality tiers: **Official**, **Verified**, and **Community**. This helps users quickly identify authoritative sources and prioritize information accordingly.

---

## 📊 Trust Levels

### 1. Official (Highest Trust)
**Criteria:**
- Official framework/library documentation
- Published by project maintainers
- Domain matches official project domain
- Digitally signed or verified authorship

**Examples:**
- `docs.flutter.dev` → Official Flutter docs
- `dart.dev` → Official Dart docs
- `firebase.google.com` → Official Firebase docs

**UI Display:** 🟢 Green badge "Official Docs"

---

### 2. Verified (Medium Trust)
**Criteria:**
- Published by recognized contributors
- Linked from official documentation
- Community-vetted tutorials
- Published by trusted organizations

**Examples:**
- Flutter team blog posts
- Google Codelabs
- Major tech company engineering blogs
- Well-maintained GitHub repositories

**UI Display:** 🔵 Blue badge "Verified"

---

### 3. Community (Standard Trust)
**Criteria:**
- User-generated content
- Stack Overflow answers
- Personal blogs
- Tutorial sites
- Default for unknown sources

**Examples:**
- Stack Overflow
- Medium articles
- Dev.to posts
- Personal blogs

**UI Display:** ⚪ Gray badge "Community"

---

## 🔍 Trust Detection Logic

### Automatic Detection

```typescript
function detectTrustLevel(doc: Document): TrustLevel {
  const { url, domain, metadata } = doc;
  
  // Official domains
  const officialDomains = [
    'docs.flutter.dev',
    'dart.dev',
    'firebase.google.com',
    'developer.android.com',
    'developer.apple.com',
  ];
  
  if (officialDomains.includes(domain)) {
    return 'official';
  }
  
  // Verified sources
  const verifiedDomains = [
    'medium.com/flutter',
    'codelabs.developers.google.com',
    'github.com/flutter',
  ];
  
  if (verifiedDomains.includes(domain)) {
    return 'verified';
  }
  
  // Default to community
  return 'community';
}
```

### Manual Override

Users can manually set trust levels:

```typescript
// Update document trust level
await updateDocument(docId, {
  source_quality: 'official', // or 'verified', 'community'
  verified_by: userId,
  verified_at: new Date(),
});
```

---

## 💾 Database Schema

### Documents Table Enhancement

```sql
-- Add trust scoring columns
ALTER TABLE documents
  ADD COLUMN source_quality TEXT DEFAULT 'community'
    CHECK (source_quality IN ('official', 'verified', 'community')),
  ADD COLUMN verified_by TEXT,
  ADD COLUMN verified_at TIMESTAMP,
  ADD COLUMN trust_score DECIMAL(3,2) DEFAULT 0.5;

-- Index for filtering by trust level
CREATE INDEX idx_documents_source_quality 
  ON documents(source_quality);
```

### Trust Score Calculation

```sql
-- Numeric trust score (0.0 - 1.0)
UPDATE documents
SET trust_score = CASE source_quality
  WHEN 'official' THEN 1.0
  WHEN 'verified' THEN 0.75
  WHEN 'community' THEN 0.5
END;
```

---

## 🔌 API Integration

### Search with Trust Filtering

```typescript
// API: POST /api/search
{
  "query": "Flutter state management",
  "trust_levels": ["official", "verified"], // Filter by trust
  "sort_by": "trust_score" // Sort by trust
}

// Response includes trust metadata
{
  "results": [
    {
      "id": "doc123",
      "title": "State Management",
      "source_quality": "official",
      "trust_score": 1.0,
      "verified_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Boost Official Sources in Ranking

```typescript
// Hybrid search with trust boost
const finalScore = 
  (vectorScore * 0.7) + 
  (bm25Score * 0.3) + 
  (trustScore * 0.1); // +10% boost for official docs
```

---

## 🎨 Frontend Display

### Trust Badges in Search Results

```tsx
function TrustBadge({ quality }: { quality: TrustLevel }) {
  const badges = {
    official: {
      label: 'Official Docs',
      color: 'bg-green-100 text-green-800',
      icon: '📗'
    },
    verified: {
      label: 'Verified',
      color: 'bg-blue-100 text-blue-800',
      icon: '✓'
    },
    community: {
      label: 'Community',
      color: 'bg-gray-100 text-gray-600',
      icon: '👥'
    }
  };
  
  const badge = badges[quality];
  
  return (
    <span className={`px-2 py-1 rounded text-xs ${badge.color}`}>
      {badge.icon} {badge.label}
    </span>
  );
}
```

---

## 🧪 Trust Level Validation

### Quality Assurance Checks

```typescript
// Periodic validation of trust levels
async function validateTrustScores() {
  const docs = await db.query(`
    SELECT id, url, source_quality
    FROM documents
    WHERE source_quality = 'official'
  `);
  
  for (const doc of docs) {
    const currentLevel = await detectTrustLevel(doc);
    
    if (currentLevel !== doc.source_quality) {
      // Log discrepancy
      logger.warn(`Trust level mismatch for ${doc.id}`);
      
      // Optionally auto-correct
      await updateDocument(doc.id, {
        source_quality: currentLevel
      });
    }
  }
}
```

---

## 📊 Trust Score Analytics

### Usage Metrics

Track how trust levels affect user behavior:

```sql
-- Most used trust levels
SELECT 
  source_quality,
  COUNT(*) as search_results,
  AVG(click_through_rate) as avg_ctr
FROM search_logs
GROUP BY source_quality;

-- Official docs get 3x more clicks
-- official: 45% CTR
-- verified: 28% CTR  
-- community: 15% CTR
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Trust scoring settings
ENABLE_TRUST_SCORING=true
DEFAULT_TRUST_LEVEL=community
TRUST_SCORE_BOOST=0.1  # 10% ranking boost

# Domain mappings
OFFICIAL_DOMAINS=docs.flutter.dev,dart.dev,firebase.google.com
VERIFIED_DOMAINS=medium.com/flutter,codelabs.developers.google.com
```

### Custom Domain Lists

```typescript
// config/trust-domains.ts
export const trustDomains = {
  official: [
    'docs.flutter.dev',
    'dart.dev',
    'api.flutter.dev',
  ],
  verified: [
    'medium.com/flutter',
    'github.com/flutter',
    'pub.dev',
  ]
};
```

---

## 🚀 Implementation Checklist

- [ ] Add trust scoring columns to database
- [ ] Implement automatic trust detection
- [ ] Create trust badge UI components
- [ ] Add trust filtering to search API
- [ ] Apply trust boost to ranking algorithm
- [ ] Add manual override capability
- [ ] Create admin UI for managing trust levels
- [ ] Add trust score validation job
- [ ] Document trust level criteria
- [ ] Test with real documents

---

## 📈 Success Metrics

**User Trust:**
- Users click official docs 3x more than community
- Reduced time to find authoritative sources
- Fewer "bad information" reports

**System Accuracy:**
- 95%+ correct automatic trust detection
- <1% false positives (community marked as official)
- Manual overrides <5% of total documents

---

## 🔒 Security Considerations

**Prevent Trust Manipulation:**
- Only admins can manually override trust levels
- Log all trust level changes
- Periodic re-validation of official sources
- Domain verification before adding to official list

**User Transparency:**
- Show why a source is marked official
- Display verification timestamp
- Allow users to report incorrect trust levels

---

## 📚 User Documentation

### For End Users

**"What do the badges mean?"**
- 📗 **Official Docs:** From the project's official documentation
- ✓ **Verified:** Trusted community sources, reviewed by maintainers
- 👥 **Community:** User-contributed content, use with caution

**"Can I filter by trust level?"**
Yes! Use the trust filter in advanced search or add `trust:official` to your query.

---

## 🎯 Future Enhancements

**Phase 14+ (Optional):**
- ML-based trust prediction
- Recency decay (older docs lose trust)
- User reputation system
- Collaborative trust voting
- Trust score explanations (why official?)

---

**Status:** Core feature for Phase 11  
**Priority:** HIGH - Improves result quality  
**Effort:** 1-2 days implementation
