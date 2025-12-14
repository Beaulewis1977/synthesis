# Plan: Update Synthesis File Type Support

## Status: ✅ IMPLEMENTED (2025-12-12)

## Goal
Enable Synthesis to ingest all file types needed for Flutter/React Native SaaS development.

---

## Current State

**Already Supported (line 278 in extract.ts):**
- `.dart` ✅
- `.ts`, `.tsx` ✅
- `.js`, `.jsx` ✅
- `.sql` ✅
- `.yaml`, `.yml` ✅
- `.json` ✅
- `.md` ✅
- `.txt` ✅
- `.pdf` ✅
- `.docx` ✅

**Missing (causing "Unsupported content type" errors):**
- `.xml` - AndroidManifest.xml, layouts, configs
- `.swift` - iOS native code
- `.kt` - Kotlin Android code
- `.java` - Java Android code
- `.gradle`, `.gradle.kts` - Build configs
- `.plist` - iOS configs
- `.hcl` - Terraform
- `.toml` - Config files (Cargo, pyproject)
- `.html` - Web files
- `.css`, `.scss` - Stylesheets
- `.sh`, `.bash` - Shell scripts
- `.env.example` - Environment templates
- `.gitignore`, `.dockerignore` - Ignore files
- `.prisma` - Prisma schema
- `.graphql`, `.gql` - GraphQL schemas

---

## Implementation

### Task 1: Add Missing File Extensions

**File:** `apps/server/src/pipeline/extract.ts`
**Line:** 278

**Change FROM:**
```typescript
if (['dart', 'ts', 'tsx', 'js', 'jsx', 'sql', 'yaml', 'yml', 'json'].includes(ext || '')) {
```

**Change TO:**
```typescript
const CODE_EXTENSIONS = [
  // Already supported
  'dart', 'ts', 'tsx', 'js', 'jsx', 'sql', 'yaml', 'yml', 'json',
  // Mobile native
  'swift', 'kt', 'java', 'm', 'h',
  // Config files
  'xml', 'plist', 'gradle', 'properties', 'toml', 'ini', 'cfg',
  // Web
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  // Infrastructure
  'hcl', 'tf', 'prisma', 'graphql', 'gql',
  // Scripts
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
  // Other
  'env', 'gitignore', 'dockerignore', 'editorconfig',
  'lock', 'sum', // package-lock.json handled by json, but lock files
  'rb', 'py', 'go', 'rs', 'c', 'cpp', 'cs', 'php', // other languages
];

if (CODE_EXTENSIONS.includes(ext || '')) {
```

### Task 2: Handle XML MIME Type

The error shows `application/xml` is being rejected. Add before line 282:

```typescript
// XML files (Android manifests, configs, etc.)
if (type.includes('xml') || ext === 'xml' || ext === 'plist') {
  return extractPlainText(buffer);
}
```

### Task 3: Handle files without extensions

Some important files have no extension:
- `Dockerfile`
- `Makefile`
- `Gemfile`
- `Podfile`

Add:
```typescript
const EXTENSIONLESS_FILES = [
  'dockerfile', 'makefile', 'gemfile', 'podfile', 'procfile',
  'vagrantfile', 'brewfile', 'rakefile', 'guardfile',
];

if (EXTENSIONLESS_FILES.includes(filename?.toLowerCase() || '')) {
  return extractPlainText(buffer);
}
```

---

## Testing

After changes, test with:
```bash
# Run the lifer sweep again - XML files should now work
cd /home/kngpnn/dev/synthesis/apps/server
npx tsx src/scripts/run-lifer-sweep.ts --pass=1A

# Check for "Unsupported content type" errors in logs
```

---

## Files to Modify

1. `apps/server/src/pipeline/extract.ts` - Add file extensions (PRIMARY)

---

## Estimated Effort

- Implementation: 10 minutes
- Testing: 5 minutes
- Total: 15 minutes

---

## Implementation Log

**2025-12-12**: Completed all tasks
- ✅ Added 40+ new file extensions to `extract.ts` line 283-301
- ✅ Added XML MIME type handling at line 277-280
- ✅ Added extensionless file handling at line 307-316
- ✅ Typecheck passed

**File modified:** `apps/server/src/pipeline/extract.ts`

---

## Notes

- All new file types use `extractPlainText()` - they're just text files
- No new dependencies needed
- This is a simple whitelist expansion
- The chunker will handle code-aware splitting if enabled
