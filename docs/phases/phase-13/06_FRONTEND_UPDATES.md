# Phase 13: Frontend Updates

**Related files panel + Code navigation**

---

## 🎯 Overview

Phase 13 adds **code intelligence** to search results:
- Show which files import/use each other
- Link test files to source files
- Display sibling files in same directory
- Enable click-through navigation

**Effort:** 6-8 hours  
**Priority:** HIGH - Makes code search actually useful

---

## 🎨 What Users See

### Before Phase 13:
```
[Search Result]
Title: auth_service.dart
Code: Future<User> login(String email, String password) { ... }
```

### After Phase 13:
```
[Search Result]
Title: auth_service.dart
Code: Future<User> login(String email, String password) { ... }

[Related Files] ← NEW PANEL
📦 Imports (2)
  → user.dart
  → http_client.dart

📝 Tests (1)
  → auth_service_test.dart

👥 Sibling Files (3)
  → user_service.dart
  → session_service.dart
  → token_service.dart
```

---

## 📦 Components to Create

### 1. Update `ResultCard.tsx` (Add related files toggle - 15 lines)

```tsx
// apps/web/src/components/ResultCard.tsx

interface ResultCardProps {
  result: ResultCard;
  collectionId: string; // NEW: pass collection context from SearchPage
}

export function ResultCard({ result, collectionId }: ResultCardProps) {
  const [showRelated, setShowRelated] = useState(false);
  const isCodeFile = result.metadata?.file_path;
  
  return (
    <div className="result-card">
      {/* Existing content: title, description, etc. */}
      
      {/* NEW: Show related files button for code files */}
      {isCodeFile && (
        <button 
          onClick={() => setShowRelated(!showRelated)}
          className="text-sm text-blue-600 hover:underline mt-2"
        >
          {showRelated ? '▼' : '▶'} Related Files
        </button>
      )}
      
      {/* NEW: Related files panel */}
      {showRelated && isCodeFile && (
        <RelatedFilesPanel 
          collectionId={collectionId}
          docId={result.id}
          filePath={result.metadata.file_path}
        />
      )}
    </div>
  );
}
```

### 2. `RelatedFilesPanel.tsx` (Main panel - 80 lines)

```tsx
// apps/web/src/components/RelatedFilesPanel.tsx

import { useQuery } from '@tanstack/react-query';

interface RelatedFilesPanelProps {
  collectionId: string; // NEW
  docId: string;
  filePath: string;
}

export function RelatedFilesPanel({ collectionId, docId, filePath }: RelatedFilesPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['related-files', docId],
    queryFn: () => 
      fetch(`/api/documents/${docId}/related-files`).then(r => r.json()),
  });
  
  if (isLoading) {
    return <div className="text-sm text-gray-500 mt-2">Loading related files...</div>;
  }
  
  if (!data?.related_files) {
    return <div className="text-sm text-gray-500 mt-2">No related files found</div>;
  }
  
  const { related_files } = data;
  
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200 text-sm">
      <div className="space-y-3">
        {/* Import relationships */}
        {related_files.imports?.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="📦 Imports"
            files={related_files.imports}
            icon="→"
          />
        )}

        {related_files.imported_by?.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="🔗 Imported By"
            files={related_files.imported_by}
            icon="←"
          />
        )}

        {/* Usage relationships */}
        {related_files.uses?.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="⚙️ Uses"
            files={related_files.uses}
            icon="⇢"
          />
        )}

        {related_files.used_by?.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="🧭 Used By"
            files={related_files.used_by}
            icon="⇠"
          />
        )}
        
        {/* Other relationships */}
        {related_files.tests?.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="📝 Tests"
            files={related_files.tests}
            icon="✓"
          />
        )}
        
        {related_files.siblings?.length > 0 && (
          <FileRelationshipSection
            collectionId={collectionId}
            title="👥 Sibling Files"
            files={related_files.siblings.slice(0, 5)} // Show max 5
            icon="•"
          />
        )}
      </div>
    </div>
  );
}
```

### 3. `FileRelationshipSection.tsx` (Relationship category - 40 lines)

```tsx
// apps/web/src/components/FileRelationshipSection.tsx

interface FileRelationshipSectionProps {
  collectionId: string; // NEW
  title: string;
  files: string[];
  icon: string;
}

export function FileRelationshipSection({ 
  collectionId,
  title, 
  files, 
  icon 
}: FileRelationshipSectionProps) {
  const [expanded, setExpanded] = useState(files.length <= 3);
  const displayFiles = expanded ? files : files.slice(0, 3);
  
  return (
    <div>
      <div className="font-medium text-gray-700 mb-1">
        {title} ({files.length})
      </div>
      
      <div className="ml-2 space-y-1">
        {displayFiles.map((file, i) => (
          <FileLink 
            key={i}
            collectionId={collectionId}
            filePath={file}
            icon={icon}
          />
        ))}
        
        {/* Show more button */}
        {files.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:underline text-xs"
          >
            {expanded ? '▲ Show less' : `▼ Show ${files.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
}
```

### 4. `FileLink.tsx` (Clickable file link - 30 lines)

```tsx
// apps/web/src/components/FileLink.tsx

interface FileLinkProps {
  collectionId: string; // NEW
  filePath: string;
  icon: string;
}

export function FileLink({ collectionId, filePath, icon }: FileLinkProps) {
  const fileName = filePath.split('/').pop() || filePath;
  const directory = filePath.substring(0, filePath.lastIndexOf('/'));
  
  const handleClick = () => {
    // Navigate to search for this file
    const query = `file:${fileName}`;
    window.location.href = `/search/${encodeURIComponent(collectionId)}?q=${encodeURIComponent(query)}`;
  };
  
  return (
    <div className="flex items-start gap-2 text-xs group">
      <span className="text-gray-400">{icon}</span>
      <button
        onClick={handleClick}
        className="text-blue-600 hover:underline text-left"
        title={filePath}
      >
        <span className="font-medium">{fileName}</span>
        {directory && (
          <span className="text-gray-500 ml-1">
            in {directory}
          </span>
        )}
      </button>
    </div>
  );
}
```

### 5. Add File Path Breadcrumbs (Optional - 25 lines)

```tsx
// apps/web/src/components/FilePathBreadcrumbs.tsx

interface FilePathBreadcrumbsProps {
  filePath: string;
}

export function FilePathBreadcrumbs({ filePath }: FilePathBreadcrumbsProps) {
  const parts = filePath.split('/');
  
  return (
    <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">/</span>}
          <button
            onClick={() => {
              // Search for files in this directory
              const dirPath = parts.slice(0, i + 1).join('/');
              window.location.href = `/search?q=path:${dirPath}`;
            }}
            className="hover:text-blue-600 hover:underline"
          >
            {part}
          </button>
        </span>
      ))}
    </div>
  );
}
```

---

## 🔌 API Integration

**Endpoint:** `GET /api/documents/:id/related-files`

**Relationships returned:**
- `imports` / `imported_by`: direct module import edges inferred from static analysis
- `uses` / `used_by`: symbol usage edges (method calls, property access, type references) that indicate runtime dependencies
- `tests`: test files mapped to their source counterpart
- `siblings`: files in the same directory for quick navigation

**Response:**
```json
{
  "file_path": "lib/services/auth_service.dart",
  "related_files": {
    "imports": [
      "lib/models/user.dart",
      "package:http/http.dart"
    ],
    "imported_by": [
      "lib/main.dart",
      "lib/screens/login_screen.dart"
    ],
    "uses": [
      "lib/models/user.dart"
    ],
    "used_by": [
      "lib/main.dart"
    ],
    "tests": [
      "test/services/auth_service_test.dart"
    ],
    "siblings": [
      "lib/services/user_service.dart",
      "lib/services/session_service.dart",
      "lib/services/token_service.dart"
    ]
  }
}
```

---

## 🧭 Routing & Navigation (Standardized)

- **Route:** `/search/:collectionId?q=...`
  - Matches existing style (`/chat/:collectionId`)
  - Keeps collection context explicit in the URL
  - Uses `q` as the search query parameter
- **SearchPage:**
  - Reads `collectionId` from route params and `q` from query string
  - Calls `POST /api/search` with `{ query: q, collection_id: collectionId }`
- **Component data flow:**
  - `SearchPage` → passes `collectionId` to `ResultCard`
  - `ResultCard` → passes `collectionId` to `RelatedFilesPanel`
  - `RelatedFilesPanel` → passes `collectionId` to `FileRelationshipSection`
  - `FileRelationshipSection` → passes `collectionId` to `FileLink`
  - `FileLink` navigates to `/search/:collectionId?q=file:<name>`

This ensures the backend receives the required `collection_id` for search without additional global state.

## ✅ Implementation Checklist

**Files to create:**
- [ ] `apps/web/src/components/RelatedFilesPanel.tsx` (80 lines)
- [ ] `apps/web/src/components/FileRelationshipSection.tsx` (40 lines)
- [ ] `apps/web/src/components/FileLink.tsx` (30 lines)
- [ ] `apps/web/src/components/FilePathBreadcrumbs.tsx` (25 lines) - Optional

**Files to modify:**
- [ ] `apps/web/src/components/ResultCard.tsx` (~15 lines added; pass `collectionId` to `RelatedFilesPanel`)
- [ ] `apps/web/src/components/RelatedFilesPanel.tsx` (accept `collectionId`, pass downstream)
- [ ] `apps/web/src/components/FileRelationshipSection.tsx` (accept `collectionId`, pass downstream)
- [ ] `apps/web/src/components/FileLink.tsx` (accept `collectionId`, navigate to `/search/:collectionId?q=...`)

**Testing:**
- [ ] Related files panel opens/closes
- [ ] File links navigate to correct search
- [ ] Shows "No related files" when none exist
- [ ] Handles missing metadata gracefully
- [ ] Expand/collapse for long lists works

**Total effort:** 6-8 hours

---

## 🎨 User Flow

### Scenario: Finding related code

1. User searches: `"login function"`
2. Results show `auth_service.dart`
3. User clicks **"▶ Related Files"**
4. Panel expands showing:
   - Imports: `user.dart`, `http_client.dart`
   - Tests: `auth_service_test.dart`
   - Siblings: `user_service.dart`, etc.
5. User clicks `user.dart` link
6. New search loads showing `user.dart` file
7. Can explore further relationships

---

## 🚫 What NOT to Add

**Keep it simple:**
- ❌ No visual dependency graph (too complex, defer to Phase 14)
- ❌ No inline code preview on hover (just link to file)
- ❌ No "open in IDE" button (can add later)
- ❌ No relationship filtering (show all by default)
- ❌ No custom relationship grouping (use backend structure)

**The panel should be:**
- ✅ Fast to load
- ✅ Simple list view
- ✅ Click-through navigation
- ✅ Minimal visual design

---

## 🎯 Alternative Layouts (Pick One)

### Option A: Expandable Panel (Recommended)
- Related files hidden by default
- Click to expand inline
- Keeps search results compact
- **Implemented above**

### Option B: Always Visible Sidebar
- Related files always shown for code results
- Fixed right sidebar
- More visible but takes space

### Option C: Hover Tooltip
- Hover over file name → tooltip shows related files
- Most compact
- Less discoverable

**Recommendation:** Use **Option A** (expandable panel) - best balance of discoverability and space efficiency.

---

## 📊 Expected Outcome

**User benefits:**
- Discover related code quickly
- Navigate codebase via relationships
- Find test files instantly
- See file context (what imports it)
- Explore project structure

**Example use case:**
```
User searches: "authentication"
Finds: auth_service.dart
Sees: Uses user.dart model
Clicks: user.dart
Discovers: User model structure
Finds: user_test.dart
Result: Full understanding of auth flow
```

---

## ✅ Success Metrics

After Phase 13 UI:
- [ ] Users can navigate between related files
- [ ] Test files linked to source files
- [ ] Load time <500ms for related files API
- [ ] Panel doesn't break mobile layout
- [ ] Works with 0, 1, or many related files

---

**Phase 13 Complete!** Users can now navigate code relationships visually.

---

## 🔄 Integration with Phase 12

**Works well with synthesis view:**
- Synthesis shows multiple approaches
- Related files shows code connections
- Together: Complete code understanding

**Example:**
1. Synthesis: "Two auth approaches: Firebase vs Supabase"
2. Related files: Shows which files use each approach
3. User: Makes informed decision based on project usage

---

**Next:** Phase 14 will add visual dependency graph (optional enhancement)
