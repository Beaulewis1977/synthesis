# Phase 5: Embedding Profiles - Summary

**Branch:** `feature/phase-5-embedding-profiles`  
**Status:** Complete  
**Date:** November 2025

---

## Overview

Phase 5 implements **Embedding Profiles** - a system for configuring chunking and embedding settings per collection. This allows users to choose between cost/quality tradeoffs without modifying environment variables.

---

## Features Implemented

### 1. Profile Presets (3 System Profiles)

| Profile | Provider | Model | Chunk Size | Code-Aware | Cost |
|---------|----------|-------|------------|------------|------|
| `fast-cheap` | ollama | nomic-embed-text | 1000 | No | Free |
| `balanced` | openai | text-embedding-3-small | 800 | Yes | Low |
| `high-accuracy` | voyage | voyage-code-2 | 600 | Yes | Medium |

### 2. Database Schema

- **`embedding_profiles` table** - Stores profile configurations
- **`collections.embedding_profile_id`** - FK reference for per-collection override
- System profiles are protected from deletion

### 3. EmbeddingProfileService

- CRUD operations for profiles
- Per-collection profile resolution with fallback to default
- Caching for performance (1-minute TTL)
- Validation for system profile protection

### 4. Admin API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/profiles` | List all profiles |
| GET | `/api/admin/profiles/:id` | Get profile by ID |
| POST | `/api/admin/profiles` | Create custom profile |
| PUT | `/api/admin/profiles/:id` | Update profile |
| DELETE | `/api/admin/profiles/:id` | Delete profile |
| GET | `/api/admin/collections/:id/profile` | Get collection's profile |
| PUT | `/api/admin/collections/:id/profile` | Set collection's profile |

### 5. Orchestrator Integration

The ingestion pipeline now:
- Fetches the collection's embedding profile
- Uses profile's `chunkSize` and `chunkOverlap` for text chunking
- Uses profile's `codeAware` setting when `CODE_CHUNKING` env is not set
- Uses profile's `provider` and `model` for embedding

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `packages/db/migrations/019_embedding_profiles.sql` | DB migration with system profiles |
| `packages/shared/src/embedding-profiles.ts` | Shared types and validation |
| `apps/server/src/services/embedding-profile-service.ts` | Profile service |
| `apps/server/src/services/__tests__/embedding-profile-service.test.ts` | Unit tests |
| `apps/server/src/routes/admin/profiles.ts` | Admin API routes |

### Modified Files

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | Export embedding profile types |
| `apps/server/src/index.ts` | Register profile routes |
| `apps/server/src/pipeline/orchestrator.ts` | Use profiles for chunking/embedding |

---

## Acceptance Criteria

- [x] 3 system profiles seeded on migration
- [x] Collections can have a profile assigned
- [x] Profile settings applied during ingestion (chunk size, provider, model)
- [x] Admin API for CRUD operations
- [x] System profiles cannot be deleted
- [x] Default profile used when collection has none
- [x] Unit tests for service

---

## API Examples

### List Profiles

```bash
curl http://localhost:3333/api/admin/profiles
```

Response:
```json
{
  "profiles": [
    {
      "id": "...",
      "name": "fast-cheap",
      "displayName": "Fast & Cheap",
      "provider": "ollama",
      "model": "nomic-embed-text",
      "chunkSize": 1000,
      "chunkOverlap": 150,
      "codeAware": false,
      "costTier": "free",
      "isSystem": true
    }
  ],
  "defaultProfileId": "..."
}
```

### Set Collection Profile

```bash
curl -X PUT http://localhost:3333/api/admin/collections/{collectionId}/profile \
  -H "Content-Type: application/json" \
  -d '{"profileId": "profile-uuid-here"}'
```

### Create Custom Profile

```bash
curl -X POST http://localhost:3333/api/admin/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-custom-profile",
    "displayName": "My Custom Profile",
    "provider": "openai",
    "model": "text-embedding-3-large",
    "chunkSize": 500,
    "chunkOverlap": 100,
    "codeAware": true,
    "costTier": "medium"
  }'
```

---

## Dependencies

- **Phase 1:** Token-aware chunking (for chunk validation)
- **Phase 3:** Metadata guarantees (for document metadata)
- **Phase 4:** Model Config Service (for provider/model validation)

---

## Next Steps

- **Phase 6:** Model Selector Admin UI - Add UI for profile selection in settings

---

## Known Issues

None identified.

---

## Testing

Run tests:
```bash
pnpm --filter @synthesis/server test -- embedding-profile
```

Run migration:
```bash
pnpm --filter @synthesis/db migrate
```
