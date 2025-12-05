# Synthesis Project - Comprehensive Security Audit Report

**Date:** December 4, 2025
**Auditor:** Claude Code Security Review
**Project:** Synthesis RAG System
**Version:** Feature branch `feature/phase-3-graph-navigation`

---

## Executive Summary

This comprehensive security audit of the Synthesis RAG project identifies **critical vulnerabilities** that must be addressed before public release. The project demonstrates solid security fundamentals (parameterized queries, input validation, encryption) but has significant gaps in authentication, authorization, and dependency security.

### Risk Summary

| Category | Risk Level | Issues Found |
|----------|-----------|--------------|
| **Authentication/Authorization** | CRITICAL | No auth system implemented |
| **Sensitive Data Exposure** | CRITICAL | Real API keys in .env file |
| **Dependency Vulnerabilities** | HIGH | 7 known CVEs (2 high, 5 moderate) |
| **Rate Limiting** | HIGH | No rate limiting on main server |
| **Infrastructure Security** | HIGH | Hardcoded credentials in Docker |
| **SQL Injection** | LOW | Well protected with parameterized queries |
| **Input Validation** | LOW | Strong Zod validation throughout |
| **File Upload Security** | MEDIUM | Basic validation, could be stronger |
| **Path Traversal** | LOW | Good UUID-based path construction |
| **XSS/SSRF** | LOW | Good sanitization and URL validation |

### Overall Risk Assessment: **HIGH**

The project is **NOT READY for public deployment** without addressing critical authentication and API key exposure issues.

---

## Table of Contents

1. [Critical Findings](#1-critical-findings)
2. [High Severity Findings](#2-high-severity-findings)
3. [Medium Severity Findings](#3-medium-severity-findings)
4. [Low Severity Findings](#4-low-severity-findings)
5. [Positive Security Findings](#5-positive-security-findings)
6. [Dependency Vulnerabilities](#6-dependency-vulnerabilities)
7. [Remediation Roadmap](#7-remediation-roadmap)
8. [Security Checklist for Public Release](#8-security-checklist-for-public-release)

---

## 1. Critical Findings

### 1.1 COMPLETE ABSENCE OF AUTHENTICATION

**Severity:** CRITICAL
**Location:** All route files in `apps/server/src/routes/`

**Description:**
No authentication system is implemented. All API endpoints are publicly accessible without any token, API key, or session validation.

**Affected Endpoints:**
- `POST /api/collections` - Create collections
- `DELETE /api/collections/:id` - Delete collections
- `POST /api/ingest` - Upload files
- `POST /api/agent/chat` - Execute AI agent tasks
- `GET /api/admin/api-keys` - View API key configurations
- `POST /api/admin/api-keys/:provider` - Store API keys
- `PUT /api/admin/models` - Modify AI model configurations

**Impact:**
- Anyone with network access can upload malicious documents
- Execute agent-based web crawling
- Configure API keys for external services
- Delete all collections and documents
- Modify model configurations
- Access and exfiltrate all stored data

**Recommendation:**
```typescript
// Implement JWT or API key authentication
import jwt from '@fastify/jwt';

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET
});

fastify.addHook('onRequest', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});
```

---

### 1.2 REAL API KEYS EXPOSED IN .env FILE

**Severity:** CRITICAL
**Location:** `/home/kngpnn/dev/synthesis/.env`

**Description:**
The `.env` file contains real, active API keys that could be exposed if accidentally committed to version control.

**Exposed Keys:**
- Anthropic API Key: `sk-ant-api03-...`
- Google API Key (Gemini): `AIzaSy...`
- OpenAI API Key: `sk-proj-...`
- Voyage AI API Key: `pa-_8N7...`
- Cohere API Key: `9v7Pt...`
- Google Search API Key: `AIzaSy...`
- API Key Encryption Master Key: `3e0b76...`

**Impact:**
- Financial liability from API abuse
- Account compromise
- Data breach via AI services
- Encrypted database keys compromised

**Immediate Actions Required:**
1. **REVOKE ALL EXPOSED KEYS IMMEDIATELY** from respective provider dashboards:
   - <https://console.anthropic.com/settings/keys>
   - <https://console.cloud.google.com/apis/credentials>
   - <https://platform.openai.com/api-keys>
   - <https://dash.voyageai.com/api-keys>
   - <https://dashboard.cohere.com/api-keys>

2. Check git history for committed keys:
   ```bash
   git log --all -p | grep -E "sk-ant-|sk-proj-|AIzaSy"
   ```

3. If keys were pushed to remote, use git-filter-repo to remove from history

---

### 1.3 AUTHORIZATION COMPLETELY ABSENT

**Severity:** CRITICAL
**Location:** All route files

**Description:**
No authorization or access control is implemented. No collection-level permissions, no user ownership validation.

**Specific Issues:**
- No route-level permission guards
- No collection-level access control
- Admin routes completely unprotected:
  - `/api/admin/api-keys` - API key management
  - `/api/admin/models` - Model configuration
  - `/api/admin/profiles` - Embedding profiles

**Impact:**
- No multi-tenancy support possible
- Any user can access all collections/documents
- Any user can modify system-wide settings

---

## 2. High Severity Findings

### 2.1 NO RATE LIMITING ON MAIN SERVER

**Severity:** HIGH
**Location:** `apps/server/src/index.ts`

**Description:**
Rate limiting exists only in MCP server but is NOT integrated into main Fastify server.

**Unprotected Endpoints:**
- `POST /api/ingest` - Unlimited file uploads
- `POST /api/search` - Unlimited search queries
- `POST /api/agent/chat` - Unlimited AI API calls

**Attack Scenarios:**
- DoS via millions of file uploads
- API quota exhaustion on Anthropic/OpenAI
- Expensive embedding operations

**Recommendation:**
```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
});

// Stricter limits for expensive endpoints
fastify.register(async function (fastify) {
  fastify.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
  });

  fastify.post('/api/agent/chat', agentChatHandler);
}, { prefix: '/api' });
```

---

### 2.2 HARDCODED DATABASE CREDENTIALS

**Severity:** HIGH
**Location:** `docker-compose.yml` (Lines 8-10, 57)

**Current Configuration:**
```yaml
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
DATABASE_URL=postgresql://postgres:postgres@synthesis-db:5432/synthesis
```

**Impact:**
Anyone with repository access knows the database credentials.

**Recommendation:**
```yaml
# Use environment variable substitution
environment:
  POSTGRES_USER: ${POSTGRES_USER:-postgres}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  POSTGRES_DB: ${POSTGRES_DB:-synthesis}
```

---

### 2.3 ALL SERVICES EXPOSED WITHOUT PROTECTION

**Severity:** HIGH
**Location:** `docker-compose.yml` (Lines 11-12, 28-29, 64-65, etc.)

**Exposed Ports:**
| Service | Port | Risk |
|---------|------|------|
| PostgreSQL | 5432:5432 | Direct DB access |
| Ollama | 11434:11434 | LLM endpoint abuse |
| Backend API | 3333:3333 | Full API access |
| Frontend | 5173:5173 | UI access |
| MCP Server | 3334:3334 | Agent access |
| Redis | 6379:6379 | Cache access |

**Recommendation:**
- Use internal Docker networks only
- Don't expose database/Redis ports externally
- Use reverse proxy with TLS termination

---

### 2.4 SESSION VALIDATION MISSING

**Severity:** HIGH
**Location:** `apps/server/src/routes/agent.ts` (Lines 85-96)

**Code:**
```typescript
if (body.session_id) {
  try {
    await addChatMessage(body.session_id, 'user', body.message);
    // No permission check - any client can write to any session_id!
  }
}
```

**Impact:**
- Session hijacking possible
- Clients can read/write to arbitrary chat sessions
- Inject messages into other users' conversations

---

### 2.5 REDIS WITHOUT AUTHENTICATION

**Severity:** HIGH
**Location:** `docker-compose.yml` (Lines 142-151)

**Current Configuration:**
```yaml
synthesis-redis:
  image: redis:7-alpine
  command: >
    sh -c "redis-server --save '' --appendonly no"
  # No requirepass configured!
```

**Recommendation:**
```yaml
command: >
  sh -c "redis-server --save '' --appendonly no --requirepass ${REDIS_PASSWORD}"
```

---

### 2.6 DATABASE CONNECTION LACKS TLS

**Severity:** HIGH
**Location:** `packages/db/src/client.ts` (Lines 13-18)

**Code:**
```typescript
pool = new Pool({
  connectionString: connString,
  max: 20,
  // Missing SSL/TLS configuration!
});
```

**Recommendation:**
```typescript
pool = new Pool({
  connectionString: connString,
  max: 20,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});
```

---

## 3. Medium Severity Findings

### 3.1 QUERY PARAMETERS WITHOUT ZOD VALIDATION

**Severity:** MEDIUM
**Locations:**
- `routes/tech-profiles.ts:42` - `category` parameter
- `routes/repos.ts:34` - `collection_id` parameter
- `routes/workflows.ts:46,79` - Multiple parameters
- `routes/feedback.ts:137` - `limit` parameter
- `routes/costs.ts:60` - Date parameters

**Recommendation:**
```typescript
const TemplateQuerySchema = z.object({
  category: z.string().optional(),
});

fastify.get('/api/tech-profiles/templates', async (request, reply) => {
  const validation = TemplateQuerySchema.safeParse(request.query);
  if (!validation.success) {
    return reply.code(400).send({ error: 'Invalid query' });
  }
});
```

---

### 3.2 MISSING SECURITY HEADERS

**Severity:** MEDIUM
**Location:** `apps/server/src/index.ts`

**Missing Headers:**
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`

**Recommendation:**
```typescript
import helmet from '@fastify/helmet';

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  },
});
```

---

### 3.3 CORS OVERLY PERMISSIVE IN DEVELOPMENT

**Severity:** MEDIUM
**Location:** `apps/server/src/index.ts` (Lines 62-76)

**Current:**
```typescript
const corsOrigins = isProduction
  ? process.env.CORS_ALLOWED_ORIGINS...
  : true;  // Allows ALL origins in development
```

**Recommendation:**
```typescript
const corsOrigins = isProduction
  ? process.env.CORS_ALLOWED_ORIGINS...
  : ['http://localhost:5173', 'http://localhost:3333'];
```

---

### 3.4 ENCRYPTION KEY DEFAULTS

**Severity:** MEDIUM
**Location:** `apps/server/src/services/api-key-service.ts` (Lines 22-23)

**Code:**
```typescript
const HKDF_SALT = process.env.API_KEY_ENCRYPTION_SALT ?? 'synthesis-api-key-encryption-salt';
const HKDF_INFO = process.env.API_KEY_ENCRYPTION_INFO ?? 'synthesis-api-key-encryption-info';
```

**Impact:** Default salt/info reduces entropy of derived keys.

---

### 3.5 readLocalFile PATH VALIDATION MISSING

**Severity:** MEDIUM
**Location:** `apps/server/src/agent/utils/storage.ts` (Lines 243-249)
**Status:** ✅ **FIXED in this PR**

**Original Issue:**
```typescript
export async function readLocalFile(filePath: string) {
  const buffer = await fs.readFile(filePath);
  // No validation that filePath is within STORAGE_ROOT!
}
```

**Applied Fix (Lines 246-251):**
```typescript
export async function readLocalFile(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(STORAGE_ROOT);
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error(`File path is outside allowed directory: ${filePath}`);
  }
  const buffer = await fs.readFile(filePath);
}
```

---

### 3.6 HOST BINDING TO 0.0.0.0

**Severity:** MEDIUM
**Location:** `apps/server/src/index.ts` (Line 43)
**Status:** ✅ **FIXED in this PR**

**Original Issue:**
```typescript
const HOST = process.env.HOST || '0.0.0.0';  // Binds to all interfaces
```

**Applied Fix:**
```typescript
// Environment-aware default: localhost for dev, 0.0.0.0 for Docker
const HOST = process.env.HOST || (process.env.DOCKER === 'true' ? '0.0.0.0' : 'localhost');
```

---

### 3.7 NO CONTAINER USER ISOLATION

**Severity:** MEDIUM
**Location:** `apps/server/Dockerfile`

**Issue:** Containers run as root by default.

**Recommendation:**
```dockerfile
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs
```

---

## 4. Low Severity Findings

### 4.1 DYNAMIC SQL PATTERNS (Code Quality)

**Severity:** LOW-MEDIUM
**Location:** `packages/db/src/queries.ts` (Lines 980-999, 1085-1099)

**Pattern:**
```typescript
let sql = 'SELECT * FROM workflow_templates WHERE 1=1';
if (category) {
  params.push(category);
  sql += ` AND category = $${params.length}`;
}
```

**Note:** Currently safe because parameters are properly parameterized, but fragile pattern.

**Recommendation:** Use static SQL with NULL-safe conditionals.

---

### 4.2 GRAPH ROUTES USE REGEX INSTEAD OF ZOD

**Severity:** LOW
**Location:** `routes/graph.ts` (Lines 197-204)

**Current:**
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(collectionId)) { ... }
```

**Recommendation:** Use `z.string().uuid()` for consistency.

---

## 5. Positive Security Findings

### 5.1 SQL INJECTION PROTECTION - EXCELLENT

All database queries use parameterized queries with `$1, $2` placeholders:
```typescript
await db.query(
  'SELECT * FROM documents WHERE collection_id = $1',
  [id]  // Parameterized
);
```

**Status:** 150+ queries reviewed, all properly parameterized.

---

### 5.2 INPUT VALIDATION - STRONG

Extensive Zod schema validation across routes:
```typescript
const SearchBodySchema = z.object({
  query: z.string().min(1),
  collection_id: z.string().uuid().optional(),
  top_k: z.number().int().min(1).max(50).optional(),
}).strict();
```

**Status:** 252 Zod `.safeParse()` calls across route handlers.

---

### 5.3 SSRF PROTECTION - COMPREHENSIVE

**Location:** `apps/server/src/services/documentOperations.ts` (Lines 287-435)

Comprehensive `isPublicUrl()` function with:
- IPv4 private range blocking (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- IPv6 private range blocking (fe80::/10, fc00::/7)
- Localhost explicitly blocked
- URL normalization before validation

---

### 5.4 XSS MITIGATION - GOOD

- Turndown removes dangerous elements: `['script', 'style', 'iframe']`
- Content extraction removes navigation/headers
- JSON API responses (no HTML rendering)

---

### 5.5 PATH TRAVERSAL PROTECTION - GOOD

**Location:** `apps/server/src/agent/utils/storage.ts`

```typescript
function validateId(id: string, name: string): void {
  const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
  if (!SAFE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid ${name}`);
  }
}
```

UUID-based path construction prevents traversal.

---

### 5.6 API KEY ENCRYPTION - IMPLEMENTED

**Location:** `apps/server/src/services/api-key-service.ts`

- AES-256-GCM encryption for stored API keys
- HKDF-SHA256 key derivation
- Environment variables take precedence
- Keys masked for display

---

### 5.7 SECRET REDACTION UTILITY - GOOD

**Location:** `apps/server/src/utils/secret-redaction.ts`

Comprehensive regex patterns for detecting and redacting sensitive keys in logs.

---

### 5.8 .gitignore PROTECTION - GOOD

`.env`, `.env.local`, `.env.*.local` properly excluded from version control.

---

## 6. Dependency Vulnerabilities

### 6.1 Vulnerability Summary

| Package | Current | Fixed | Severity | CVE |
|---------|---------|-------|----------|-----|
| @modelcontextprotocol/sdk | 1.19.1 | ≥1.24.0 | HIGH | CVE-2025-66414 |
| glob | 10.4.5 | ≥10.5.0 | HIGH | CVE-2025-64756 |
| js-yaml | 4.1.0 | ≥4.1.1 | MODERATE | CVE-2025-64718 |
| vite | 5.4.20 | ≥5.4.21 | MODERATE | CVE-2025-62522 |
| esbuild | 0.21.5 | ≥0.25.0 | MODERATE | CVE-2025-56024 |
| electron | 33.2.0 | ≥35.7.5 | MODERATE | CVE-2025-55305 |
| body-parser | 2.2.0 | ≥2.2.1 | MODERATE | CVE-2025-13466 |

### 6.2 HIGH Severity Details

#### CVE-2025-66414: MCP SDK DNS Rebinding

**Package:** `@modelcontextprotocol/sdk@1.19.1`
**Location:** `apps/mcp/package.json:29`

MCP TypeScript SDK does not enable DNS rebinding protection by default. Malicious websites can bypass same-origin policy and send requests to local MCP server.

**Mitigation:** Update to ≥1.24.0

#### CVE-2025-64756: glob CLI Command Injection

**Package:** `glob@10.4.5` (transitive)

glob CLI `-c/--cmd` option enables shell:true, allowing command injection via malicious filenames.

**Affected Paths:**
- vitest coverage infrastructure
- electron-builder
- tsup (sucrase)
- tailwindcss (sucrase)

**Mitigation:** Update to ≥10.5.0

### 6.3 Update Commands

```bash
# Priority 1 - Critical
pnpm update --filter @synthesis/mcp @modelcontextprotocol/sdk@^1.24.0
pnpm update --filter @synthesis/server js-yaml@^4.1.1

# Priority 2 - High
pnpm update --filter @synthesis/server playwright@^1.56.0
pnpm update --filter @synthesis/desktop electron@^35.7.5

# Verify all updates
pnpm audit
```

---

## 7. Remediation Roadmap

### Phase 1: CRITICAL (Before Public Release)

| Task | Priority | Effort |
|------|----------|--------|
| Revoke all exposed API keys | CRITICAL | 1 hour |
| Implement authentication (JWT/API keys) | CRITICAL | 8 hours |
| Add authorization/access control | CRITICAL | 8 hours |
| Update MCP SDK to fix DNS rebinding | CRITICAL | 30 min |
| Update js-yaml to fix prototype pollution | CRITICAL | 30 min |
| Remove hardcoded credentials from docker-compose | CRITICAL | 1 hour |

### Phase 2: HIGH (Before Network Deployment)

| Task | Priority | Effort |
|------|----------|--------|
| Implement rate limiting | HIGH | 4 hours |
| Add session ownership validation | HIGH | 4 hours |
| Configure Redis authentication | HIGH | 1 hour |
| Add database TLS configuration | HIGH | 2 hours |
| Update remaining vulnerable dependencies | HIGH | 2 hours |
| Don't expose database/Redis ports externally | HIGH | 1 hour |

### Phase 3: MEDIUM (Production Hardening)

| Task | Priority | Effort |
|------|----------|--------|
| Add security headers (@fastify/helmet) | MEDIUM | 2 hours |
| Add Zod validation for query parameters | MEDIUM | 4 hours |
| Add path validation to readLocalFile | MEDIUM | 1 hour |
| Configure container user isolation | MEDIUM | 2 hours |
| Add Docker security options | MEDIUM | 2 hours |
| Add health checks for all services | MEDIUM | 2 hours |
| Configure resource limits | MEDIUM | 1 hour |

### Phase 4: LOW (Continuous Improvement)

| Task | Priority | Effort |
|------|----------|--------|
| Refactor dynamic SQL patterns | LOW | 4 hours |
| Replace regex validation with Zod | LOW | 2 hours |
| Implement secrets management (Vault/KMS) | LOW | 8 hours |
| Add security scanning to CI/CD | LOW | 4 hours |
| Conduct penetration testing | LOW | External |

---

## 8. Security Checklist for Public Release

### Pre-Release Requirements

- [ ] **All API keys revoked and regenerated**
- [ ] **Authentication system implemented**
- [ ] **Authorization/access control implemented**
- [ ] **Rate limiting enabled**
- [ ] **All CRITICAL/HIGH CVEs patched**
- [ ] **Database credentials not hardcoded**
- [ ] **Redis authentication enabled**
- [ ] **Security headers configured**
- [ ] **.env.example has no real values**
- [ ] **git history cleaned of secrets**

### Documentation Requirements

- [ ] **SECURITY.md created** with:
  - Security model explanation
  - Known limitations
  - Vulnerability reporting process
  - Authentication setup guide
- [ ] **README.md updated** with:
  - Security considerations section
  - Environment variable requirements
  - Production deployment warnings

### Deployment Requirements

- [ ] **HTTPS enforced for production**
- [ ] **Database ports not exposed externally**
- [ ] **Containers running as non-root**
- [ ] **Resource limits configured**
- [ ] **Logging and monitoring enabled**
- [ ] **Backup and recovery tested**

---

## Appendix A: Files Reviewed

### Critical Files

| File | Lines | Status |
|------|-------|--------|
| `apps/server/src/index.ts` | 150 | Reviewed |
| `apps/server/src/routes/*.ts` | ~2000 | Reviewed |
| `apps/server/src/services/*.ts` | ~3000 | Reviewed |
| `apps/server/src/agent/*.ts` | ~500 | Reviewed |
| `packages/db/src/queries.ts` | 1100+ | Reviewed |
| `packages/db/src/client.ts` | 50 | Reviewed |
| `docker-compose.yml` | 160 | Reviewed |
| `.env.example` | 55 | Reviewed |
| `.gitignore` | 40 | Reviewed |
| `pnpm-lock.yaml` | 335KB | Audited |

### Routes Reviewed

- `collections.ts` - Collection CRUD
- `documents.ts` - Document management
- `search.ts` - Search endpoints
- `agent.ts` - AI agent chat
- `ingest.ts` - File upload
- `chat.ts` - Chat sessions
- `graph.ts` - Knowledge graph
- `api-keys.ts` - API key management
- `models.ts` - Model configuration
- `profiles.ts` - Embedding profiles
- `tech-profiles.ts` - Tech stack profiles
- `workflows.ts` - Workflow management
- `repos.ts` - Repository ingestion
- `feedback.ts` - User feedback
- `costs.ts` - Cost tracking

---

## Appendix B: Security Contacts

For security vulnerabilities discovered after public release:

1. **Report Method:** Create a private security advisory on GitHub
2. **Response Time:** 48 hours for acknowledgment
3. **Disclosure Policy:** Coordinated disclosure (90 days)

---

**Report Generated:** December 4, 2025
**Classification:** Internal - Security Sensitive
**Distribution:** Project maintainers only until issues resolved
