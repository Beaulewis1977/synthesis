# Bug Report & Feature Requests - User Testing Feedback

**Date:** 2025-11-20  
**Status:** Needs Implementation  
**Priority:** High

---

## 🔴 Critical Issues

### 1. Missing "Create Collection" Button

**Problem:**  
- Dashboard (`/`) shows collections but has no way to create new ones
- CollectionView page also missing "Create Collection" button
- User stuck on empty state with no action available

**Current State:**
- ✅ `CreateCollectionModal` component exists (`apps/web/src/components/CreateCollectionModal.tsx`)
- ✅ API endpoint exists (`POST /api/collections`)
- ❌ **No UI trigger** to open the modal

**Expected Behavior:**
- Dashboard should have "Create Collection" button (top-right or in empty state)
- CollectionView should have "Create Collection" button in header

**Files to Modify:**
- `apps/web/src/pages/Dashboard.tsx` - Add button + modal state
- `apps/web/src/pages/CollectionView.tsx` - Add button + modal state (optional, lower priority)

**Implementation:**
```typescript
// In Dashboard.tsx
import { CreateCollectionModal } from '../components/CreateCollectionModal';
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

// Add button in header:
<button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
  + Create Collection
</button>

// Add modal:
<CreateCollectionModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
```

**Priority:** 🔴 **HIGH** - Blocks user from using the app

---

### 2. Upload Page Navigation Missing

**Problem:**  
- Upload page exists (`/upload/:id`) but no navigation link visible
- User can't find how to upload documents

**Current State:**
- ✅ Upload route exists (`apps/web/src/App.tsx` line 39)
- ✅ UploadPage component exists (`apps/web/src/pages/UploadPage.tsx`)
- ✅ CollectionView has Upload button (line 120) that navigates to `/upload/${id}`
- ❌ **Dashboard has no upload link** (but this might be intentional - upload is per-collection)

**Status:**  
- **Actually works** - Upload button exists in CollectionView
- User might not have noticed it, or it's not prominent enough

**Recommendation:**
- Verify Upload button is visible in CollectionView
- Consider making it more prominent (icon + text, larger size)
- Add tooltip: "Upload documents to this collection"

**Priority:** 🟡 **MEDIUM** - May be UX visibility issue, not missing feature

---

### 3. ENABLE_SYNTHESIS Feature Flag Not Set

**Problem:**  
- Synthesis feature disabled error: "Set ENABLE_SYNTHESIS=true in your environment"
- User clicked "Synthesis View" in chat but feature is off

**Current State:**
- ✅ Feature flag check exists (`apps/server/src/routes/synthesis.ts` line 17)
- ✅ Error message shown in UI (`apps/web/src/components/SynthesisView.tsx` line 49)
- ❌ **Environment variable not set** in `.env`

**Solution:**
Add to `.env` file:
```bash
ENABLE_SYNTHESIS=true
```

**Documentation:**
- See `docs/CONFIGURATION.md` line 852
- See `docs/TROUBLESHOOTING.md` line 1277

**Priority:** 🟡 **MEDIUM** - Configuration issue, not a bug

**Action Required:**
- Update `.env.example` to document this clearly
- Add startup check/warning if feature is requested but disabled
- Consider making it default `true` for development

---

## 🟡 Feature Status Questions

### 4. Cost Dashboard Functionality

**Question:** Is the cost API dashboard actually functional?

**Current State:**
- ✅ Cost routes exist (`apps/server/src/routes/costs.ts`)
- ✅ CostDashboard page exists (`apps/web/src/pages/CostDashboard.tsx`)
- ✅ API client methods exist (`apps/web/src/lib/api.ts` lines 222-243)
- ✅ Navigation link exists in Layout (`apps/web/src/components/Layout.tsx` line 21)

**Endpoints Available:**
- `GET /api/costs/summary` - Current month summary
- `GET /api/costs/history` - Historical data
- `GET /api/costs/alerts` - Budget alerts

**Verification Needed:**
- Test if `/costs` page loads
- Test if API endpoints return data
- Check if cost tracking is actually recording costs

**Priority:** 🟢 **LOW** - Likely functional, needs verification

---

### 5. Agent Ingestion - Google Search API Missing ✅ FIXED

**Problem:**  
- Autonomous ingestion agent fails with: "Google Search configuration missing (GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX)"
- User tried to ingest "flutter official docs" but search failed

**Status:** ✅ **RESOLVED**
- Google Search API keys added to `apps/server/.env`
- Server restarted and configuration loaded
- Search now works (found 10 URLs for "flutter official docs")

**Additional Issue Found:**
- Playwright browsers not installed → all scraping failed
- **Fixed:** Ran `pnpm exec playwright install chromium`
- Ingestion now works end-to-end

**Lessons Learned:**
- Server loads `.env` from `apps/server/.env` (not repo root)
- Playwright browsers must be installed for scraping to work
- Error messages should include setup instructions

**Action Required:**
- Add Playwright installation to setup documentation
- Add to `.env.example` with comments
- Consider making search optional (fallback to manual URL input)
- Improve error messages with actionable setup steps

---

## 🟢 Feature Requests

### 6. Document Detail View & Metadata Display

**Request:**  
Build a comprehensive document detail view that shows all document information and allows management actions.

**Current State:**
- ✅ Document list shows basic info (title, type, size, relative time)
- ✅ Document type exists (`apps/web/src/types/index.ts` lines 11-28)
- ✅ Database has metadata fields (`created_at`, `processed_at`, `source_url`, `version`, etc.)
- ❌ **No detail view/modal** - can't click into documents
- ❌ **Document IDs not visible** in UI
- ❌ **No way to see full metadata** (ingestion date, source URL, version history)
- ❌ **No update/edit capability** for documents

**Required Features:**

1. **Document Detail Modal/Page:**
   - Route: `/collections/:id/documents/:docId` or modal
   - Click document in list → opens detail view
   - Show all metadata:
     - Document ID (UUID, copyable)
     - Title (editable)
     - Description/Summary (from metadata or auto-generated)
     - Source URL (if available, clickable link)
     - File path (if local file)
     - Content type
     - File size
     - **Creation date** (when document was originally created, if available in metadata)
     - **Ingestion date** (`created_at` - when added to Synthesis)
     - **Processing date** (`processed_at` - when pipeline completed)
     - **Last checked** (`last_checked_at` - for URL-based docs)
     - Version number (currently `version` field exists)
     - Status (pending/complete/error)
     - Error message (if any)

2. **Document Actions:**
   - **Update/Edit** button:
     - Edit title
     - Edit description/summary
     - Re-upload file (replace content)
     - Update metadata
   - **Refresh** button (already exists, but should be in detail view)
   - **Delete** button (already exists, but should be in detail view)
   - **View Raw Content** (if file_path exists)
   - **View Chunks** (list all chunks with preview)
   - **View Version History** (when version control is implemented)

3. **Document ID Display:**
   - Show UUID in document list (optional toggle: "Show IDs")
   - Show UUID prominently in detail view
   - Copy-to-clipboard button for ID
   - Use shortened format: `abc123...xyz789` with expand to full

**Implementation Plan:**

**Backend:**
- `GET /api/documents/:id` - Get full document details with all metadata
- `PUT /api/documents/:id` - Update document (title, description, metadata)
- `POST /api/documents/:id/replace` - Replace document content (re-upload)
- `GET /api/documents/:id/chunks` - List all chunks for document
- `GET /api/documents/:id/content` - Get raw file content (if file_path exists)

**Frontend:**
- New component: `DocumentDetailModal.tsx` or `DocumentDetailPage.tsx`
- Update `DocumentList.tsx` to make items clickable
- Add route: `/collections/:collectionId/documents/:docId` (if using page, not modal)
- Display all metadata fields in organized sections
- Form for editing title/description
- File upload for content replacement

**Priority:** 🔴 **HIGH** - Essential for document management, especially with version control coming

**Estimated Effort:** 1-2 days (backend API + frontend UI)

---

### 7. Ingestion Agent Control & Filtering

**Request:**  
Provide more control over what the ingestion agent finds and ingests, with ability to review and remove unwanted documents.

**Current State:**
- ✅ Ingestion agent searches Google and scrapes URLs
- ✅ Creates documents automatically
- ✅ Shows job status with URLs found/scraped/ingested/failed
- ❌ **No preview/review step** before ingestion
- ❌ **No filtering** of search results
- ❌ **No way to exclude specific URLs** before scraping
- ❌ **No bulk removal** of agent-ingested documents

**Required Features:**

1. **Pre-Ingestion Review:**
   - After search completes, show list of URLs found
   - Allow user to:
     - ✅ Check/uncheck URLs to include/exclude
     - Preview URL (title, snippet from Google)
     - See estimated content size
     - Filter by domain (e.g., exclude reddit.com)
   - "Start Ingestion" button only processes selected URLs

2. **Ingestion Filters:**
   - Domain whitelist/blacklist (persistent settings)
   - Content type filters (e.g., only docs, no forums)
   - URL pattern matching (regex)
   - Max URLs per job (already exists: `AGENT_MAX_URLS`)
   - Min content length (skip very short pages)

3. **Post-Ingestion Management:**
   - Filter documents by source: "Agent Ingested" vs "Manual Upload"
   - Bulk select agent-ingested documents
   - Bulk delete with confirmation
   - "Remove all from this job" action
   - Tag documents with ingestion job ID for tracking

4. **Ingestion Job History:**
   - View past ingestion jobs
   - See which documents came from which job
   - Re-run job with different filters
   - Delete entire job and its documents

**Implementation Plan:**

**Backend:**
- `GET /api/ingestion-agent/jobs` - List all jobs
- `GET /api/ingestion-agent/jobs/:id` - Get job details with URLs
- `PUT /api/ingestion-agent/jobs/:id/urls/:urlId` - Toggle URL inclusion
- `POST /api/ingestion-agent/jobs/:id/start-filtered` - Start with filtered URLs
- `GET /api/documents?source=ingestion-agent&job_id=:id` - Filter documents by source
- `DELETE /api/ingestion-agent/jobs/:id` - Delete job and optionally its documents

**Frontend:**
- Update `AgentIngestionPage.tsx`:
  - Add URL review step after search
  - Checkbox list of URLs with preview
  - Filter controls (domain, content type)
  - Job history panel
- Update `CollectionView.tsx`:
  - Filter by source type
  - Show ingestion job ID in document metadata
  - Bulk actions for agent documents

**Database:**
- Add `ingestion_job_id` to documents table (nullable, FK to ingestion_jobs)
- Add `ingestion_filters` JSONB to ingestion_jobs table (store filter settings)

**Priority:** 🟡 **MEDIUM** - Important for quality control, but not blocking

**Estimated Effort:** 2-3 days (filters + review UI + job management)

---

### 8. Document Version Control UI (Pre-Implementation)

**Request:**  
Prepare UI for document version control system planned in `docs/new-phase.md` (Phase 16).

**Current State:**
- ✅ Database has `version` field (default 1)
- ✅ Version control architecture designed (`docs/new-phase.md`)
- ❌ **Version control not yet implemented** (marked "DO NOT DO THIS PLAN YET")
- ❌ **No UI for version history**
- ❌ **No UI for document updates/patches**

**Planned Features (from `docs/new-phase.md`):**

1. **Version History View:**
   - Timeline of document versions
   - Show parent/child relationships
   - Display version number, creation date, author/actor
   - Show which version is canonical (active)
   - Rollback to previous version

2. **Document Update/Edit UI:**
   - "Update Document" button in detail view
   - Diff viewer (Monaco/CodeMirror)
   - Submit update proposal
   - View validation status (proposed → validating → validated → approved)
   - Approve/reject updates (if user has DocumentApprover role)

3. **Version Badges:**
   - Show version number in document list
   - Badge in chat citations: "Version 3 (Approved Oct 15, 2025)"
   - Indicate if document has pending updates

4. **Chunk Overrides:**
   - View patched chunks vs original
   - See patch author and validation status
   - Approve/reject chunk-level patches

**Note:** This is **preparation for future implementation**. The backend version control system (Phase 16) is not yet built, but UI should be designed to accommodate it.

**Priority:** 🟢 **LOW** - Future feature, but should be considered in current UI design

**Action Required:**
- Design document detail view with version history section (hidden until Phase 16)
- Add version number display in document list
- Plan UI structure for update proposals and approval workflow

---

### 9. LLM Model Selector & Custom Model Management

**Request:**  
Build a system to:
1. **Select LLM models** in the chat UI (currently hardcoded to `claude-3-7-sonnet-20250219`)
2. **Add custom LLM models** with settings for:
   - Base URL (for custom/self-hosted models)
   - API Key
   - Model name/identifier
   - Provider type (OpenAI-compatible, Anthropic, custom)

**Current State:**
- ✅ Embedding providers are configurable (Ollama, OpenAI, Voyage)
- ✅ Provider configs exist (`apps/server/src/services/embedding-router.ts`)
- ❌ **Chat agent hardcoded to single model** (`apps/server/src/agent/agent.ts` line 125)
- ❌ **No UI for model selection** in chat interface
- ❌ **No UI for adding custom models**
- ❌ **No dynamic model registration**

**Architecture:**

**Recommended Approach: Database Configuration**
- New table: `llm_models` with columns: `id`, `name`, `base_url`, `api_key`, `provider_type`, `model_identifier`, `enabled`, `is_default`
- UI: Settings page + Chat model selector dropdown

**Implementation Plan:**

1. **Database Migration:**
```sql
CREATE TABLE llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT, -- Encrypted or in env var reference
  provider_type VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'custom'
  model_identifier VARCHAR(255) NOT NULL, -- e.g., 'gpt-4', 'claude-3-opus', 'llama-3-70b'
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  context_window INTEGER, -- Optional: for UI display
  cost_tier VARCHAR(20), -- 'free', 'low', 'medium', 'high'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (provider_type, model_identifier)
);

-- Insert default Anthropic model
INSERT INTO llm_models (name, base_url, provider_type, model_identifier, is_default, enabled)
VALUES ('Claude 3.7 Sonnet', 'https://api.anthropic.com', 'anthropic', 'claude-3-7-sonnet-20250219', true, true);
```

2. **Backend API:**
- `GET /api/models` - List all enabled models
- `POST /api/models` - Add new model
- `PUT /api/models/:id` - Update model
- `DELETE /api/models/:id` - Delete model
- `POST /api/models/:id/test` - Test connection
- `POST /api/models/:id/set-default` - Set as default model

3. **Backend Integration:**
- Update `apps/server/src/agent/agent.ts` to accept `model_id` parameter
- Create model client factory that supports OpenAI-compatible and Anthropic APIs
- Update `POST /api/agent/chat` to accept optional `model_id` parameter

4. **Frontend UI:**
- **Settings Page** (`/settings/models`):
  - List all models with enable/disable toggle
  - Add/Edit form: Name, Base URL, API Key, Provider Type, Model ID
  - Test connection button
  - Set default button
- **Chat UI Model Selector**:
  - Dropdown in chat header showing current model
  - Quick switch between enabled models
  - Show model metadata (context window, cost tier)

5. **Model Client Factory:**
```typescript
// apps/server/src/services/model-client.ts
export async function createModelClient(modelId: string) {
  const model = await getLLMModel(modelId);
  if (model.provider_type === 'anthropic') {
    return new Anthropic({ apiKey: model.api_key });
  } else if (model.provider_type === 'openai' || model.provider_type === 'custom') {
    // Use OpenAI-compatible client
    return new OpenAI({ baseURL: model.base_url, apiKey: model.api_key });
  }
}
```

**Priority:** 🟡 **MEDIUM** - Improves flexibility and user control

**Estimated Effort:** 3-4 days (database + API + UI + model client abstraction)

---

### 10. MCP Server Management UI

**Request:**  
Build a UI to:
1. **View available MCP servers** (Synthesis MCP + external servers)
2. **Add external MCP servers** (URL, transport type, auth)
3. **Toggle MCP servers on/off** (enable/disable)
4. **Toggle individual tools** within MCP servers
5. **View tool definitions** and status

**Current State:**
- ✅ Synthesis MCP server exists (`apps/mcp/src/index.ts`)
- ✅ MCP server exposes tools to external agents (Cursor, Claude Desktop)
- ❌ **No UI for MCP server management**
- ❌ **No way to add external MCP servers**
- ❌ **No way to toggle servers/tools on/off**
- ❌ **Chat agent doesn't use MCP servers** (uses local tools directly)

**Architecture Understanding:**

**Current Flow:**
1. **Chat Agent** (`apps/server/src/agent/agent.ts`):
   - Uses Anthropic Messages API directly
   - Calls local tools defined in `apps/server/src/agent/tools.ts`
   - Does NOT use MCP servers

2. **MCP Server** (`apps/mcp/src/index.ts`):
   - Exposes Synthesis tools to EXTERNAL agents (Cursor, Claude Desktop)
   - Acts as a bridge for IDE agents to use Synthesis
   - Uses stdio or HTTP transport

**Proposed Architecture:**

**Option A: MCP Server as Tool Provider for Chat Agent**
- Chat agent can call external MCP servers as tools
- MCP servers become first-class tool sources
- Requires MCP client library integration

**Option B: MCP Server Registry (Simpler)**
- UI to manage MCP server configurations
- Store configs in database
- Desktop app can use these configs (Phase 2 of desktop app)
- Chat agent continues using local tools (no change)

**Recommended Approach: Option B (Phase 1) + Option A (Phase 2)**

**Phase 1: MCP Server Registry (UI Only)**
- Database table for MCP server configs
- UI to add/edit/delete MCP servers
- Toggle servers on/off
- View tool lists
- **Use case:** Desktop app Phase 2 will use this config

**Phase 2: MCP Client Integration (Future)**
- Chat agent can call external MCP servers
- Tool routing: local tools vs MCP tools
- Tool conflict resolution

**Implementation Plan (Phase 1):**

1. **Database Migration:**
```sql
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  transport_type VARCHAR(50) NOT NULL, -- 'stdio', 'sse', 'http'
  command TEXT, -- For stdio: command to run
  url TEXT, -- For http/sse: server URL
  env_vars JSONB DEFAULT '{}'::jsonb, -- Environment variables
  enabled BOOLEAN DEFAULT true,
  tools JSONB DEFAULT '[]'::jsonb, -- Cached tool definitions
  last_connected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE mcp_server_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  tool_description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (server_id, tool_name)
);
```

2. **Backend API:**
- `GET /api/mcp/servers` - List all MCP servers
- `POST /api/mcp/servers` - Add new MCP server
- `PUT /api/mcp/servers/:id` - Update MCP server
- `DELETE /api/mcp/servers/:id` - Delete MCP server
- `POST /api/mcp/servers/:id/toggle` - Enable/disable server
- `GET /api/mcp/servers/:id/tools` - List tools for server
- `POST /api/mcp/servers/:id/tools/:toolName/toggle` - Enable/disable tool
- `POST /api/mcp/servers/:id/connect` - Test connection and fetch tools

3. **Frontend UI:**
- **Settings Page** (`/settings/mcp`):
  - List all MCP servers with status (enabled/disabled, connected/offline)
  - Add/Edit form:
    - Name, Description
    - Transport Type (stdio/SSE/HTTP)
    - Command (for stdio) or URL (for HTTP/SSE)
    - Environment variables (key-value pairs)
  - Toggle server on/off
  - View tools list with enable/disable toggles
  - Test connection button
  - Delete button

4. **Integration with Desktop App:**
- Desktop app Phase 2 will read from `mcp_servers` table
- Display servers in UI with toggle controls
- Save config to `.synthesis/mcp-config.json` (as per desktop app plan)

**Priority:** 🟡 **MEDIUM** - Essential for desktop app Phase 2, useful for future MCP client integration

**Estimated Effort:** 2-3 days (database + API + UI)

**Future Enhancement (Phase 2):**
- Integrate MCP client into chat agent
- Allow chat agent to call external MCP tools
- Tool routing and conflict resolution

---

### 11. Features from `new-phase.md` (Phase 16) - Document Version Control

**Request:**  
Implement document version control system as outlined in `docs/new-phase.md` (Phase 16).

**Key Features from `new-phase.md`:**
1. **Document Versioning:**
   - Version history with parent-child relationships
   - Canonical version tracking
   - Lock versioning for conflict resolution

2. **Chunk Overlays:**
   - Patch-level updates to specific chunks
   - Status workflow: `proposed → validating → validated → approved/rejected`
   - Search prefers approved overrides

3. **Agent Workflow:**
   - Agent can propose document updates
   - Automated validation (tests/lint)
   - Approval workflow with roles

4. **UI Components:**
   - Document version timeline
   - Diff viewer for changes
   - Approval controls
   - Version badges in chat citations

**Current State:**
- ✅ Detailed plan exists in `docs/new-phase.md`
- ✅ Database schema defined (lines 126-172)
- ✅ API contracts defined (lines 174-235)
- ❌ **Not yet implemented**
- ❌ **Not in current build plan**

**Integration with Existing Features:**
- Complements **Feature Request #6** (Document Detail View)
- Complements **Feature Request #8** (Document Version Control UI - Pre-Implementation)
- Required for **Feature Request #7** (Ingestion Agent Control) - agents need to update documents

**Priority:** 🟡 **MEDIUM** - Essential for agent reliability, but complex implementation

**Estimated Effort:** 4-5 days (database + pipeline + API + UI + validation system)

**Action Required:**
- Add Phase 16 to build plan
- Prioritize UI components (document detail view, version timeline, diff viewer)
- Consider phased rollout: versioning first, then chunk overlays, then agent workflow

---

### 12. Features from `07_EXTENDED_TECH_STACK_AND_REPO_INGESTION_PLAN.md`

**Request:**  
Review and prioritize features from extended tech stack plan.

**Key Features:**

#### 12.1 GitHub Repo Ingestion & Sync (Section 3.2)
- **Feature:** Ingest entire GitHub repositories, not just single files/URLs
- **Components:**
  - Clone repo to temp directory
  - Walk tree with language-aware filters
  - Incremental sync (git diff to find changes)
  - Map repos to collections
  - MCP tools: `add_repo_to_collection`, `sync_repo`
- **Current State:** Partially implemented (see `packages/db/migrations/011_repo_tracking.sql`)
- **Priority:** 🟡 **MEDIUM** - Useful for large codebases

#### 12.2 Tech-Stack-Aware Collection Profiles (Section 3.3)
- **Feature:** Collections know their tech stack (languages, frameworks, versions)
- **Components:**
  - Collection manifest with `primary_languages`, `frameworks`, version info
  - Auto-detection + manual override
  - Retrieval tuning (prefer matching stack docs)
  - Profile templates (Flutter+Supabase, React Native, etc.)
- **Current State:** Basic tech detection exists, but no collection profiles
- **Priority:** 🟢 **LOW** - Nice-to-have for better search relevance

#### 12.3 Multi-Language Code Intelligence (Section 3.1)
- **Feature:** Extend AST chunking beyond Dart/TypeScript to Kotlin, Java, Swift, Python
- **Components:**
  - Language detection & metadata
  - Project-structure-aware chunking (Gradle, Xcode, React)
  - Function/class-level chunking
  - File relationship tracking
- **Current State:** Dart/TypeScript supported, others not
- **Priority:** 🟢 **LOW** - Depends on user's tech stack needs

#### 12.4 Feedback & Evaluation Loop (Section 3.4)
- **Feature:** User/agent feedback on search results and synthesis answers
- **Components:**
  - Feedback table (query, result_ids, rating, comments)
  - UI: thumbs up/down on results
  - MCP tools for agent feedback
  - Offline analysis for ranking improvements
- **Current State:** Not implemented
- **Priority:** 🟢 **LOW** - Future enhancement for quality improvement

**Recommended Priority Order:**
1. **GitHub Repo Ingestion** (if user works with large repos)
2. **Tech-Stack Profiles** (if user has multiple tech stacks)
3. **Multi-Language Support** (if user needs Kotlin/Java/Swift)
4. **Feedback Loop** (future enhancement)

**Action Required:**
- User to confirm which features are needed
- Add selected features to build plan
- Estimate effort per feature

---

## 📋 Summary & Action Items

### New Feature Requests (High Priority)
6. ✅ **Document Detail View & Metadata Display** - Essential for document management
7. ✅ **Ingestion Agent Control & Filtering** - Quality control for agent-ingested content
8. ✅ **Document Version Control UI (Pre-Implementation)** - Prepare UI for Phase 16

### New Feature Requests (Medium Priority)
9. ✅ **LLM Model Selector & Custom Model Management** - Select models in chat + add custom models
10. ✅ **MCP Server Management UI** - Add/manage/toggle MCP servers and tools
11. ✅ **Document Version Control (Phase 16)** - Full versioning system from `new-phase.md`
12. ✅ **Extended Tech Stack Features** - GitHub repo ingestion, tech-stack profiles, multi-language support

### Existing Feature Requests (Low Priority)

### Immediate Fixes (High Priority)
1. ✅ **Add "Create Collection" button to Dashboard** - Blocks core functionality
2. ✅ **Verify Upload button visibility** - May be UX issue

### Configuration Issues (Medium Priority)
3. ✅ **Document ENABLE_SYNTHESIS setup** - Add to `.env.example` with clear instructions
4. ✅ **Document Google Search API setup** - ✅ FIXED (keys added, working)
5. ✅ **Document Playwright installation** - Add to setup docs (required for ingestion agent)

### Verification Needed (Low Priority)
5. ✅ **Test Cost Dashboard** - Verify endpoints work, data displays correctly

### Feature Requests (Future)
6. ✅ **Document Detail View & Metadata Display** - Clickable documents with full info, edit capability
7. ✅ **Ingestion Agent Control & Filtering** - Review URLs before ingestion, filter domains, bulk management
8. ✅ **Document Version Control UI** - Prepare UI for Phase 16 version control system
9. ✅ **LLM Model Selector & Custom Model Management** - Select models in chat + add custom models via UI
10. ✅ **MCP Server Management UI** - Add/manage/toggle MCP servers and tools
11. ✅ **Document Version Control (Phase 16)** - Full versioning system with chunk overlays and agent workflow
12. ✅ **Extended Tech Stack Features** - GitHub repo ingestion, tech-stack profiles, multi-language support

---

## 🔧 Quick Fixes for Agent

### Fix #1: Add Create Collection Button

**File:** `apps/web/src/pages/Dashboard.tsx`

```typescript
import { useState } from 'react';
import { CreateCollectionModal } from '../components/CreateCollectionModal';
import { Plus } from 'lucide-react';

// Inside Dashboard component:
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

// Replace empty state (line 43-49) with:
{!isLoading && !isError && data?.collections.length === 0 && (
  <div className="card text-center py-xl">
    <Folder className="mx-auto text-text-secondary mb-md" size={48} />
    <h3 className="text-lg font-semibold text-text-primary mb-sm">No collections yet</h3>
    <p className="text-text-secondary mb-md">Create your first collection to get started</p>
    <button 
      onClick={() => setIsCreateModalOpen(true)} 
      className="btn btn-primary flex items-center gap-2 mx-auto"
    >
      <Plus size={18} />
      Create Collection
    </button>
  </div>
)}

// Add button in header (after line 16):
<div className="flex items-center justify-between mb-md">
  <div>
    <h1 className="text-2xl font-bold text-text-primary mb-md">Your Collections</h1>
    <p className="text-text-secondary">Manage and explore your document collections</p>
  </div>
  <button 
    onClick={() => setIsCreateModalOpen(true)} 
    className="btn btn-primary flex items-center gap-2"
  >
    <Plus size={18} />
    Create Collection
  </button>
</div>

// Add modal at end (before closing div):
<CreateCollectionModal 
  isOpen={isCreateModalOpen} 
  onClose={() => setIsCreateModalOpen(false)} 
/>
```

### Fix #2: Improve ENABLE_SYNTHESIS Error Message

**File:** `apps/web/src/components/SynthesisView.tsx`

Add link to documentation:
```typescript
// Line 49, improve error message:
<div className="text-sm text-text-secondary mt-2">
  <p>The synthesis feature is not enabled on the backend.</p>
  <p className="mt-1">
    Add <code className="bg-gray-100 px-1 rounded">ENABLE_SYNTHESIS=true</code> to your <code className="bg-gray-100 px-1 rounded">.env</code> file and restart the server.
  </p>
</div>
```

### Fix #3: Improve Google Search Error Message

**File:** `apps/server/src/ingestion-agent/search.ts`

Add setup instructions:
```typescript
// Line 24, improve error:
throw new Error(
  'Google Search configuration missing (GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX).\n' +
  'Setup: 1) Get API key from https://developers.google.com/custom-search/v1/overview\n' +
  '       2) Create search engine at https://programmablesearchengine.google.com/\n' +
  '       3) Add both to .env file'
);
```

---

## 📝 Notes for Agent

- **Do NOT change anything** until user approves this report
- Focus on **High Priority** items first
- Test each fix independently
- Update `.env.example` with all required variables
- Add helpful error messages with setup instructions

## 🔍 Additional Considerations

### Document Metadata Enhancements

**Current Gaps:**
- No way to see document "about" or summary
- No distinction between document creation date vs ingestion date
- Metadata field exists but not surfaced in UI
- No way to add custom tags or categories

**Recommendations:**
- Auto-generate summaries from first chunk or metadata
- Extract creation date from file metadata (if available)
- Add tags/categories system for better organization
- Show chunk count and embedding status

### Ingestion Agent Improvements

**Current Limitations:**
- No way to see what was ingested before it's too late
- Can't preview content before ingestion
- No quality scoring or filtering
- All URLs processed blindly

**Future Enhancements:**
- Content quality scoring (length, structure, readability)
- Duplicate detection (check if URL already ingested)
- Domain reputation scoring
- Content type detection (docs vs forums vs blogs)
- Automatic categorization based on content

### Version Control Preparation

**UI Design Considerations:**
- Document detail view should have "Version History" section (hidden until Phase 16)
- Version badge should be clickable → shows history
- Design diff viewer component early (reusable for updates)
- Plan approval workflow UI (roles, permissions, notifications)

**Database Considerations:**
- Current `version` field is just a number
- Need to add `parent_doc_id`, `is_canonical` when Phase 16 starts
- Document detail view should show version relationships
- Plan for `document_events` table integration

