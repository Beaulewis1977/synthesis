#!/bin/bash
# Phases 4-9 Issues (Consolidated)
set -e

REPO="beaulewis1977/synthesis"

echo "📝 Creating Phases 4-9 issues..."

#==============================================================================
# PHASE 4: AUTONOMOUS WEB FETCHING (Day 4)
#==============================================================================

gh issue create --repo $REPO \
  --title "Phase 4: Autonomous Web Fetching" \
  --label "phase-4,epic,priority:high" \
  --milestone "Phase 3-4: Agent & Autonomy" \
  --body "## 🎯 Overview
**Goal:** Agent autonomously fetches docs from URLs

## ⏱️ Duration
Day 4 (8 hours)

## 📚 Documentation
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-4-autonomous-web-fetching\`
- **fetch_web_content Tool:** \`docs/04_AGENT_TOOLS.md#3-fetch_web_content\`
- **All 7 Tools:** \`docs/04_AGENT_TOOLS.md\`
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-4-prompt\`

## ✅ Acceptance Criteria
- [ ] Playwright installed and configured
- [ ] fetch_web_content tool implemented (single page)
- [ ] Crawling mode works (multiple pages, same domain)
- [ ] HTML to Markdown conversion
- [ ] Remaining 5 tools implemented:
  - add_document
  - list_collections
  - list_documents  
  - delete_document
  - get_document_status
- [ ] All 7 tools registered with agent
- [ ] Multi-step workflows work

## 📝 Stories
See individual issues for implementation details

## 📝 Definition of Done
- [ ] All 2 story issues closed
- [ ] Phase summary created
- [ ] PR merged to develop"

gh issue create --repo $REPO \
  --title "Implement fetch_web_content tool with crawling" \
  --label "phase-4,feature,priority:high" \
  --milestone "Phase 3-4: Agent & Autonomy" \
  --body "## 📋 Context
Part of Phase 4 - Morning task

## 🎯 What to Build
- Single page fetch mode
- Multi-page crawl mode (same domain)
- HTML to Markdown conversion
- Save and process content

## 📚 Documentation
\`docs/04_AGENT_TOOLS.md#3-fetch_web_content\`

## 📦 Dependencies
\`\`\`json
{\"playwright\": \"^1.40.0\", \"turndown\": \"^7.1.2\"}
\`\`\`

## ✅ Acceptance Criteria
- [ ] Playwright installed: \`npx playwright install chromium\`
- [ ] Single page mode fetches HTML
- [ ] Multi-page mode crawls up to max_pages
- [ ] Stays on same domain
- [ ] Converts HTML to clean Markdown
- [ ] Saves content and triggers ingestion
- [ ] Tool registered with agent"

gh issue create --repo $REPO \
  --title "Implement remaining 5 agent tools" \
  --label "phase-4,feature,priority:high" \
  --milestone "Phase 3-4: Agent & Autonomy" \
  --body "## 📋 Context
Part of Phase 4 - Afternoon task

## 🎯 What to Build
Implement 5 remaining tools:
1. add_document - Add doc from file/URL
2. list_collections - List all collections
3. list_documents - List docs in collection
4. delete_document - Delete a document
5. get_document_status - Check processing status

## 📚 Documentation
\`docs/04_AGENT_TOOLS.md\` (tools #2, 4, 5, 6, 7)

## 📁 Files to Create
\`\`\`
apps/server/src/agent/tools/
├── add-document.ts
├── list-collections.ts
├── list-documents.ts
├── delete-document.ts
└── get-status.ts
\`\`\`

## ✅ Acceptance Criteria
- [ ] All 5 tools implemented per specs
- [ ] All registered with agent
- [ ] Agent can call each tool
- [ ] Multi-step workflows work
- [ ] Tests pass"

#==============================================================================
# PHASE 5: FRONTEND UI (Day 5)
#==============================================================================

gh issue create --repo $REPO \
  --title "Phase 5: Frontend UI" \
  --label "phase-5,epic,priority:high" \
  --milestone "Phase 5-6: UI & MCP" \
  --body "## 🎯 Overview
**Goal:** Basic functional UI for collections, upload, chat

## ⏱️ Duration
Day 5 (8 hours)

## 📚 Documentation
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-5-frontend-ui\`
- **UI Spec:** \`docs/08_UI_SPEC.md\` (all pages + wireframes)
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-5-prompt\`

## ✅ Acceptance Criteria
- [ ] React Router configured
- [ ] Tailwind CSS working
- [ ] React Query for data fetching
- [ ] Dashboard page (collection list)
- [ ] Collection view page (document list)
- [ ] Upload page (drag & drop)
- [ ] Chat page (message list + input)
- [ ] Can create collections
- [ ] Can upload files
- [ ] Can chat with agent
- [ ] Citations displayed

## 📝 Definition of Done
- [ ] All 3 story issues closed
- [ ] UI loads at http://localhost:5173
- [ ] Phase summary created
- [ ] PR merged to develop"

gh issue create --repo $REPO \
  --title "Setup React app with routing and styling" \
  --label "phase-5,feature,priority:high" \
  --milestone "Phase 5-6: UI & MCP" \
  --body "## 📋 Context
Part of Phase 5 - Morning task

## 🎯 What to Build
- React Router
- Tailwind CSS
- React Query
- Basic layout

## 📦 Dependencies
\`\`\`json
{
  \"react-router-dom\": \"^6.20.0\",
  \"@tanstack/react-query\": \"^5.14.0\",
  \"lucide-react\": \"^0.294.0\"
}
\`\`\`

## 📚 Documentation
\`docs/08_UI_SPEC.md\`

## ✅ Acceptance Criteria
- [ ] Routing: /, /collections/:id, /upload/:id, /chat/:id
- [ ] Tailwind working
- [ ] React Query provider
- [ ] Basic app shell with header"

gh issue create --repo $REPO \
  --title "Build Dashboard and Collection view pages" \
  --label "phase-5,feature,priority:high" \
  --milestone "Phase 5-6: UI & MCP" \
  --body "## 📋 Context
Part of Phase 5

## 🎯 What to Build
- Dashboard: List collections
- Collection view: List documents
- Create collection modal

## 📚 Documentation
\`docs/08_UI_SPEC.md#page-1-dashboard\` and \`#page-2-collection-view\`

## ✅ Acceptance Criteria
- [ ] Dashboard lists collections
- [ ] Collection cards show doc count
- [ ] Can navigate to collection
- [ ] Collection view shows documents
- [ ] Document list shows status"

gh issue create --repo $REPO \
  --title "Build Upload and Chat pages" \
  --label "phase-5,feature,priority:high" \
  --milestone "Phase 5-6: UI & MCP" \
  --body "## 📋 Context
Part of Phase 5

## 🎯 What to Build
- Upload page with drag & drop
- Chat page with messages

## 📚 Documentation
\`docs/08_UI_SPEC.md#page-3-upload\` and \`#page-4-chat\`

## ✅ Acceptance Criteria
- [ ] Drag & drop works
- [ ] Upload progress shown
- [ ] Chat displays messages
- [ ] Citations shown
- [ ] Tool calls visible"

#==============================================================================
# PHASE 6: MCP SERVER (Day 6)
#==============================================================================

gh issue create --repo $REPO \
  --title "Phase 6: MCP Server" \
  --label "phase-6,epic,priority:high" \
  --milestone "Phase 5-6: UI & MCP" \
  --body "## 🎯 Overview
**Goal:** External agents access RAG via MCP

## ⏱️ Duration
Day 6 (8 hours)

## 📚 Documentation
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-6-mcp-server\`
- **MCP Implementation:** \`docs/07_MCP_SERVER.md\`
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-6-prompt\`

## ✅ Acceptance Criteria
- [ ] MCP SDK installed
- [ ] search_docs tool implemented
- [ ] list_collections tool implemented
- [ ] stdio mode works (WSL/IDE agents)
- [ ] SSE mode works (Windows/Claude Desktop)
- [ ] Both modes call backend API
- [ ] Tested from Cursor
- [ ] Tested from Claude Desktop

## 📝 Definition of Done
- [ ] All 2 story issues closed
- [ ] Phase summary created
- [ ] PR merged to develop"

gh issue create --repo $REPO \
  --title "Create MCP server with stdio mode" \
  --label "phase-6,feature,priority:high" \
  --milestone "Phase 5-6: UI & MCP" \
  --body "## 📋 Context
Part of Phase 6 - Morning task

## 🎯 What to Build
- MCP server with 2 tools
- stdio transport for IDE agents

## 📦 Dependencies
\`\`\`json
{\"@modelcontextprotocol/sdk\": \"^1.0.0\"}
\`\`\`

## 📚 Documentation
\`docs/07_MCP_SERVER.md#stdio-mode\`

## ✅ Acceptance Criteria
- [ ] apps/mcp/ package created
- [ ] search_docs tool implemented
- [ ] list_collections tool implemented
- [ ] stdio transport works
- [ ] Calls backend API
- [ ] Tested from command line"

gh issue create --repo $REPO \
  --title "Add SSE mode for Claude Desktop" \
  --label "phase-6,feature,priority:high" \
  --milestone "Phase 5-6: UI & MCP" \
  --body "## 📋 Context
Part of Phase 6 - Afternoon task

## 🎯 What to Build
- SSE transport for Windows
- HTTP server on port 3334

## 📦 Dependencies
\`\`\`json
{\"express\": \"^4.19.2\"}
\`\`\`

## 📚 Documentation
\`docs/07_MCP_SERVER.md#sse-mode\`

## ✅ Acceptance Criteria
- [ ] SSE server on port 3334
- [ ] Same tools as stdio mode
- [ ] Tested from Claude Desktop (Windows)"

#==============================================================================
# PHASE 7: DOCKER (Day 7)
#==============================================================================

gh issue create --repo $REPO \
  --title "Phase 7: Docker Integration" \
  --label "phase-7,epic,priority:high" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 🎯 Overview
**Goal:** Everything runs in Docker

## ⏱️ Duration
Day 7 (8 hours)

## 📚 Documentation
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-7-docker--testing\`
- **Container Names:** synthesis-db, synthesis-ollama, synthesis-server, synthesis-web, synthesis-mcp
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-7-prompt\`

## ✅ Acceptance Criteria
- [ ] Dockerfiles for server, web, mcp
- [ ] docker-compose.yml complete
- [ ] Clear container names (synthesis-*)
- [ ] Ollama with GPU support
- [ ] Networks configured
- [ ] \`docker compose up\` works
- [ ] All services healthy
- [ ] Data persists across restarts

## 📝 Definition of Done
- [ ] All 2 story issues closed
- [ ] Phase summary created
- [ ] PR merged to develop"

gh issue create --repo $REPO \
  --title "Create Dockerfiles for all services" \
  --label "phase-7,feature,priority:high" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 📋 Context
Part of Phase 7 - Morning task

## 🎯 What to Build
- apps/server/Dockerfile
- apps/web/Dockerfile
- apps/mcp/Dockerfile

## 📚 Documentation
\`docs/10_ENV_SETUP.md#docker-setup\`

## ✅ Acceptance Criteria
- [ ] All Dockerfiles created
- [ ] Multi-stage builds
- [ ] Builds succeed
- [ ] Images tagged correctly"

gh issue create --repo $REPO \
  --title "Create docker-compose with clear names" \
  --label "phase-7,feature,priority:high" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 📋 Context
Part of Phase 7 - Afternoon task

## 🎯 What to Build
Complete docker-compose.yml with 5 services:
- synthesis-db
- synthesis-ollama  
- synthesis-server
- synthesis-web
- synthesis-mcp

## 📚 Documentation
\`docs/02_ARCHITECTURE.md#docker-architecture\`

## ✅ Acceptance Criteria
- [ ] All 5 services defined
- [ ] Clear container names
- [ ] Networks configured
- [ ] Volumes for persistence
- [ ] \`docker compose up\` works
- [ ] All services healthy"

#==============================================================================
# PHASE 8: POLISH (Day 8)
#==============================================================================

gh issue create --repo $REPO \
  --title "Phase 8: Polish and Error Handling" \
  --label "phase-8,epic,priority:medium" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 🎯 Overview
**Goal:** Production-ready polish

## ⏱️ Duration
Day 8 (8 hours)

## 📚 Documentation
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-8-polish--documentation\`
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-8-9-prompt\`

## ✅ Acceptance Criteria
- [ ] Try/catch everywhere
- [ ] User-friendly error messages
- [ ] Loading states in UI
- [ ] Error states in UI
- [ ] Empty states in UI
- [ ] Collection management (create/delete)
- [ ] README.md written
- [ ] Documentation updated

## 📝 Definition of Done
- [ ] All 2 story issues closed
- [ ] Phase summary created
- [ ] PR merged to develop"

gh issue create --repo $REPO \
  --title "Add comprehensive error handling" \
  --label "phase-8,feature,priority:medium" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 📋 Context
Part of Phase 8 - Morning task

## 🎯 What to Build
- Error handling in all routes
- Proper logging (pino)
- User-friendly messages

## ✅ Acceptance Criteria
- [ ] All async functions have try/catch
- [ ] Errors logged properly
- [ ] API returns meaningful errors
- [ ] UI shows error messages"

gh issue create --repo $REPO \
  --title "Polish UI with states and collection management" \
  --label "phase-8,feature,priority:medium" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 📋 Context
Part of Phase 8

## 🎯 What to Build
- Loading/error/empty states
- Create collection UI
- Delete collection UI

## ✅ Acceptance Criteria
- [ ] All pages have loading states
- [ ] Error states show helpful messages
- [ ] Empty states guide users
- [ ] Can create collections
- [ ] Can delete collections (with confirmation)"

#==============================================================================
# PHASE 9: FINAL TESTING (Day 9)
#==============================================================================

gh issue create --repo $REPO \
  --title "Phase 9: Final Testing and Documentation" \
  --label "phase-9,epic,priority:high" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 🎯 Overview
**Goal:** Production-ready MVP

## ⏱️ Duration
Day 9 (8 hours)

## 📚 Documentation
- **Build Plan:** \`docs/09_BUILD_PLAN.md#day-9-final-testing--buffer\`
- **MVP Criteria:** \`docs/09_BUILD_PLAN.md#mvp-acceptance-criteria\`
- **Agent Prompts:** \`docs/15_AGENT_PROMPTS.md#phase-8-9-prompt\`

## ✅ Acceptance Criteria (MVP)
All criteria from \`docs/09_BUILD_PLAN.md#mvp-acceptance-criteria\`:
- [ ] Upload 5+ PDFs, DOCX, MD files
- [ ] 3 collections working
- [ ] Agent autonomy verified
- [ ] Search quality good
- [ ] MCP works from IDE and Claude Desktop
- [ ] Docker works
- [ ] Documentation complete

## 📝 Definition of Done
- [ ] All story issues closed
- [ ] MVP acceptance criteria met
- [ ] Phase summary created
- [ ] Final PR merged to develop
- [ ] READY FOR USE!"

gh issue create --repo $REPO \
  --title "Test with real documents (20+ files)" \
  --label "phase-9,test,priority:high" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 📋 Context
Part of Phase 9

## 🎯 What to Do
- Upload YOUR actual documentation
- Test all workflows
- Verify search quality
- Test MCP from both modes

## ✅ Acceptance Criteria
- [ ] 20+ real docs uploaded
- [ ] Agent conversations work
- [ ] MCP tested from Cursor (stdio)
- [ ] MCP tested from Claude Desktop (SSE)
- [ ] All MVP criteria verified"

gh issue create --repo $REPO \
  --title "Create comprehensive documentation" \
  --label "phase-9,docs,priority:high" \
  --milestone "Phase 7-9: Production Ready" \
  --body "## 📋 Context
Part of Phase 9

## 🎯 What to Build
- Main README.md
- Quick start guide
- Troubleshooting guide
- Demo screenshots

## ✅ Acceptance Criteria
- [ ] README has quick start
- [ ] Environment setup documented
- [ ] API examples work
- [ ] Troubleshooting section
- [ ] Screenshots added"

echo "✅ All Phase 4-9 issues created"
