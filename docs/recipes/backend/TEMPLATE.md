---
# =============================================================================
# Recipe Frontmatter Schema
# =============================================================================
# All fields are parsed during ingestion and used for feature-aware retrieval.

# REQUIRED FIELDS
title: "Recipe Title"                    # Human-readable title
platform: backend                        # ContentPlatform: mobile | web | backend | shared
framework: fastify                       # DocumentFramework: fastify | node | postgres | redis
feature_tags:                            # BackendFeatureTag[]: at least one required
  - api                                  # Primary feature
  - cache                                # Secondary features (optional)
usage_tier: recipe                       # UsageTier: always 'recipe' for recipe docs

# RECOMMENDED FIELDS
framework_version: "4.x"                 # Target framework version
tech_stack:                              # Related technologies
  - nodejs
  - typescript
difficulty: intermediate                 # beginner | intermediate | advanced
last_updated: 2025-12-07                 # ISO date of last update

# OPTIONAL FIELDS
recommended: true                        # Mark as recommended for this feature
author: "Your Name"                      # Recipe author
tested_versions:                         # Versions this was tested with
  - "Node.js 22"
  - "Fastify 4.28.1"
---

# {Recipe Title}

> **Summary:** One to three sentences describing the recommended approach and what this recipe covers.

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 22+ installed
- [ ] Docker running (for infrastructure)
- [ ] Basic understanding of {concept}

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Fastify   | 4.28.x  | Web Framework |
| {Package} | ^X.Y.Z  | {Purpose} |

## Implementation

### 1. Service Setup

{Description}

```typescript
// apps/server/src/services/example-service.ts
import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  // Plugin code
}
```

### 2. Usage Pattern

{Description}

```typescript
// Usage example
```

## Common Pitfalls

### 1. {Pitfall Name}

**Problem:** {Description}

**Solution:**

```typescript
// Fix code
```

## Alternatives

### {Alternative Approach}

**Trade-offs:**

- Pro: {Benefit}
- Con: {Drawback}
