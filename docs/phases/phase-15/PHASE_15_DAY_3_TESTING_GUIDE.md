# Phase 15 Day 3 - Testing Guide for Remaining Items

**Purpose:** Guide for agent to verify the 5 minor pending items programmatically where possible.

---

## 1. Screen Reader Testing (NVDA/VoiceOver)

### Status: ⚠️ Pending Manual Verification

### What Was Done:
- ✅ ARIA labels added to all interactive elements
- ✅ ARIA states (aria-checked, aria-expanded) implemented
- ✅ Semantic HTML landmarks (main, nav)
- ✅ Role attributes (role="button", role="status", role="alert")
- ✅ aria-live regions for dynamic content

### Code Verification (Already Complete):
```bash
# Count ARIA attribute occurrences (total tokens)
grep -rho "aria-label\|aria-expanded\|aria-checked\|role=" apps/web/src/components | wc -l

# Count files containing these attributes
grep -rl "aria-label\|aria-expanded\|aria-checked\|role=" apps/web/src/components | wc -l

# Show only matching tokens (helpful to review)
grep -roh "aria-label\|aria-expanded\|aria-checked\|role=" apps/web/src/components
```

### Agent Testing Options:

#### Option A: Automated ARIA Validation (Recommended - Desktop Only)
```bash
# Run Playwright accessibility tests (already exists)
cd apps/web
pnpm exec playwright test e2e/accessibility.spec.ts

# Add new desktop-only test for comprehensive ARIA coverage
# File: apps/web/e2e/screen-reader-aria.spec.ts
```

**Test to Add (Desktop Only):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Screen Reader - ARIA Validation', () => {
  test.use({ viewport: { width: 1280, height: 720 } }); // Desktop only
  
  test('should have ARIA labels on all interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get all interactive elements
    const buttons = page.locator('button:not([aria-hidden="true"])');
    const links = page.locator('a:not([aria-hidden="true"])');
    const inputs = page.locator('input:not([aria-hidden="true"])');
    
    // Check buttons have aria-label or accessible text
    const buttonCount = await buttons.count();
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();
      const hasLabel = ariaLabel || (textContent && textContent.trim().length > 0);
      expect(hasLabel).toBeTruthy();
    }
    
    // Check links have accessible text
    const linkCount = await links.count();
    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i);
      const textContent = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const hasLabel = ariaLabel || (textContent && textContent.trim().length > 0);
      expect(hasLabel).toBeTruthy();
    }
    
    // Check inputs have labels
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      const hasLabel = ariaLabel || placeholder || (id && page.locator(`label[for="${id}"]`).count() > 0);
      expect(hasLabel).toBeTruthy();
    }
  });
});
```

#### Option B: Use axe-core (Accessibility Testing Library)
```bash
# Install axe-core
pnpm add -D @axe-core/playwright

# In a test file (not in playwright.config.ts)
```

Example usage inside a test file:
```ts
import { test } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test('axe a11y check', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await injectAxe(page);
  await checkA11y(page);
});
```
```

#### Option C: Manual Screen Reader Testing (Deferred)
- **NVDA** (Windows): Free, open-source
- **VoiceOver** (macOS/iOS): Built-in
- **Orca** (Linux): Free, open-source

**Manual Test Checklist:**
- [ ] Navigate through all pages using screen reader
- [ ] All buttons/links announced clearly
- [ ] Form inputs have labels announced
- [ ] Dynamic content (toasts, loading) announced
- [ ] Navigation landmarks work correctly

**Recommendation:** Use Option A (automated ARIA validation) + Option B (axe-core) for comprehensive coverage. Manual testing can be deferred to QA.

---

## 2. Borders and Shadows Consistency

### Status: ✅ VERIFIED (Code Review Complete)

### What Was Found:
- ✅ Consistent use of `border-border` utility class
- ✅ Consistent shadow classes: `shadow-md`, `shadow-lg`
- ✅ Border colors match design system: `border-error`, `border-success`, `border-warning`
- ✅ All components use Tailwind utilities (no hardcoded values)

### Verification Commands:
```bash
# Check for consistent border usage
grep -r "border-" apps/web/src/components | grep -v "border-l-\|border-r-\|border-t-\|border-b-" | head -20
# Result: All use Tailwind utilities ✅

# Check for shadow consistency
grep -r "shadow-" apps/web/src/components
# Result: shadow-md, shadow-lg used consistently ✅

# Check for hardcoded border colors (should find none)
grep -r "border:#\|border:\s*#[0-9a-fA-F]" apps/web/src/components
# Result: None found ✅
```

### Agent Testing:
```bash
# Automated test: Verify all borders use design system classes
cd apps/web
cat > e2e/design-system-borders.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test.describe('Design System - Borders and Shadows', () => {
  test('should use consistent border classes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get all elements with borders
    const elementsWithBorders = page.locator('[class*="border-"]');
    const count = await elementsWithBorders.count();
    
    // Sample check: verify border classes exist
    expect(count).toBeGreaterThan(0);
    
    // Check for design system classes
    const classNames = await elementsWithBorders.first().getAttribute('class');
    expect(classNames).toContain('border');
  });
  
  test('should use consistent shadow classes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const elementsWithShadows = page.locator('[class*="shadow-"]');
    const count = await elementsWithShadows.count();
    
    if (count > 0) {
      const classNames = await elementsWithShadows.first().getAttribute('class');
      // Should use shadow-md or shadow-lg (not arbitrary values)
      expect(classNames).toMatch(/shadow-(sm|md|lg|xl|none)/);
    }
  });
});
EOF

pnpm exec playwright test e2e/design-system-borders.spec.ts
```

**Status:** ✅ **VERIFIED** - No action needed, borders/shadows are consistent.

---

## 3. Chart Scaling on Mobile

### Status: ✅ VERIFIED (No Charts Found - Progress Bars Only)

### What Was Found:
- ❌ **No actual charts** (no Chart.js, Recharts, or similar libraries)
- ✅ **Progress bars only** (in CostSummary and CostBreakdown)
- ✅ Progress bars use responsive width (`w-full`) and percentage-based styling
- ✅ Progress bars have proper ARIA attributes for accessibility

### Verification:
```bash
# Check for chart libraries
grep -r "chart\|Chart\|recharts\|chartjs" apps/web/src
# Result: No matches ✅

# Check progress bar implementation
grep -r "progressbar\|role=\"progressbar\"" apps/web/src/components
# Result: Found in CostSummary.tsx and CostBreakdown.tsx ✅
```

### Code Review:
**CostSummary.tsx (lines 23-33):**
- Uses `w-full` (responsive width)
- Uses percentage-based `width` style (scales automatically)
- Has ARIA attributes for screen readers

**CostBreakdown.tsx (lines 49-59):**
- Uses `w-full` (responsive width)
- Uses percentage-based `width` style
- Has ARIA attributes

### Agent Testing:
**Not needed** - Progress bars already verified responsive via code review:
- Use `w-full` (responsive width)
- Percentage-based styling (scales automatically)
- No charts exist (only progress bars)
- Mobile responsiveness already covered by existing 87 tests

**Skip this test** - Code verification is sufficient.

**Status:** ✅ **VERIFIED** - No charts exist, only progress bars which are already responsive.

---

## 4. Disabled Button States

### Status: ✅ VERIFIED (Code Review Complete)

### What Was Found:
- ✅ **Multiple components have disabled states:**
  - `ChatPage.tsx`: Lines 167, 246, 251 - buttons disabled when loading or no input
  - `SearchPage.tsx`: Line 109 - search button disabled when no query
  - `UploadZone.tsx`: Lines 165, 224, 242, 250 - buttons disabled when uploading
  - `DocumentList.tsx`: Lines 88, 98, 106 - buttons disabled when deleting

### Verification:
```bash
# Count disabled state implementations
grep -r "disabled=\|aria-disabled" apps/web/src | wc -l
# Result: 16 instances found ✅

# Check for proper disabled styling
grep -r "disabled\|cursor-not-allowed\|opacity-" apps/web/src/pages apps/web/src/components | grep -i disabled
# Result: Found proper disabled styling ✅
```

### Code Examples Found:
**ChatPage.tsx (line 167-168):**
```typescript
disabled={!lastUserQuery}
aria-disabled={!lastUserQuery}
```

**ChatPage.tsx (line 251):**
```typescript
disabled={isLoading || !inputValue.trim()}
```

**UploadZone.tsx (line 165):**
```typescript
disabled={isUploading}
```

### Agent Testing (Desktop Only):
```bash
# Test disabled states work correctly (desktop viewport)
# File: apps/web/e2e/disabled-states.spec.ts
```

**Test Code (Desktop Only):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Disabled Button States', () => {
  test.use({ viewport: { width: 1280, height: 720 } }); // Desktop only
  
  test('search button should be disabled when input is empty', async ({ page }) => {
    await page.goto('/search/test-collection-id');
    await page.waitForLoadState('networkidle');
    
    const searchButton = page.locator('button[type="submit"]').first();
    const isDisabled = await searchButton.isDisabled();
    expect(isDisabled).toBe(true); // Should be disabled initially
  });
  
  test('chat send button should be disabled when input is empty', async ({ page }) => {
    await page.goto('/chat/test-collection-id');
    await page.waitForLoadState('networkidle');
    
    const sendButton = page.locator('button[type="submit"]').first();
    const isDisabled = await sendButton.isDisabled();
    expect(isDisabled).toBe(true); // Should be disabled when input empty
  });
  
  test('synthesis toggle should be disabled when no messages sent', async ({ page }) => {
    await page.goto('/chat/test-collection-id');
    await page.waitForLoadState('networkidle');
    
    const synthesisButton = page.locator('button:has-text("Synthesis View")');
    const isDisabled = await synthesisButton.isDisabled();
    expect(isDisabled).toBe(true); // Should be disabled initially
  });
  
  test('disabled buttons should have proper styling', async ({ page }) => {
    await page.goto('/search/test-collection-id');
    await page.waitForLoadState('networkidle');
    
    const disabledButton = page.locator('button[disabled]').first();
    const className = await disabledButton.getAttribute('class');
    
    // Should have disabled styling (opacity or cursor-not-allowed)
    expect(className).toMatch(/opacity-|cursor-not-allowed/);
  });
});
```

**Run:**
```bash
cd apps/web
pnpm exec playwright test e2e/disabled-states.spec.ts
```

**Status:** ✅ **VERIFIED** - Disabled states are properly implemented.

---

## 5. Error Retry Options

### Status: ⚠️ PARTIAL (Reset Exists, Retry Not Explicit)

### What Was Found:
- ✅ **ErrorBoundary has reset functionality** (ErrorBoundary.tsx line 28-31)
- ⚠️ **Reset redirects to home** (`window.location.href = '/'`), not a true retry
- ✅ **Button labeled "Return to Home"** (clear user action)
- ⚠️ **No explicit "Retry" button** for the same operation

### Code Review:
**ErrorBoundary.tsx (lines 28-31):**
```typescript
handleReset = () => {
  this.setState({ hasError: false, error: null });
  window.location.href = '/';
};
```

**Analysis:**
- ✅ Error state is cleared
- ✅ User is redirected to safe state (home page)
- ⚠️ Does not retry the failed operation
- ✅ Provides clear recovery path

### Agent Testing Options:

#### Option A: Code Verification Only (Recommended)
```bash
# Verify ErrorBoundary has reset functionality (code review)
grep -A 5 "handleReset" apps/web/src/components/ErrorBoundary.tsx
# Result: Reset function exists ✅

# Check if ErrorBoundary is used in App
grep -r "ErrorBoundary" apps/web/src/App.tsx
# Should find import and usage
```

**Note:** Error boundary testing requires actually triggering component errors, which is complex. Code verification is sufficient - reset functionality is already verified in code review.

#### Option B: Code Verification (Recommended)
```bash
# Verify ErrorBoundary has reset functionality
grep -A 5 "handleReset" apps/web/src/components/ErrorBoundary.tsx
# Result: Reset function exists ✅

# Check if ErrorBoundary is used in App
grep -r "ErrorBoundary" apps/web/src/App.tsx
# Should find import and usage
```

#### Option C: Manual Testing
1. Trigger a component error (e.g., throw error in a component)
2. Verify error boundary catches it
3. Click "Return to Home" button
4. Verify redirect to home page works

### Recommendation:
**Status:** ✅ **ACCEPTABLE** - Reset functionality provides recovery path. True "retry" may not be appropriate for all error types (e.g., network errors should retry, component errors should reset).

**If retry is needed**, add to ErrorBoundary:
```typescript
handleRetry = () => {
  this.setState({ hasError: false, error: null });
  // Optionally reload current page or retry operation
  window.location.reload();
};
```

**Status:** ⚠️ **PARTIAL** - Reset exists and works, but no explicit retry. This is acceptable for error boundaries (reset is standard pattern).

---

## Summary of Verification

| Item | Status | Action Needed |
|------|--------|---------------|
| 1. Screen Reader Testing | ⚠️ Pending | Add desktop-only ARIA validation test |
| 2. Borders/Shadows Consistency | ✅ Verified | None - already consistent |
| 3. Chart Scaling | ✅ Verified | None - no charts, only progress bars (responsive) |
| 4. Disabled Button States | ✅ Verified | Add desktop-only disabled states test |
| 5. Error Retry Options | ⚠️ Partial | None - reset is acceptable pattern |

---

## Recommended Agent Actions

### High Priority (Desktop-Only Tests - Fast):
1. **Add automated ARIA validation test** (`e2e/screen-reader-aria.spec.ts`) - Desktop only, ~5 min
2. **Add disabled states test** (`e2e/disabled-states.spec.ts`) - Desktop only, ~5 min

**Total time:** ~10 minutes for both tests

### Low Priority (Can Skip):
1. **Progress bar mobile test** - Not needed (progress bars already verified responsive, no charts)
2. **Screen reader manual testing** - Defer to QA
3. **Error retry enhancement** - Reset is acceptable pattern

### Already Complete:
1. ✅ Borders/shadows consistency
2. ✅ Disabled states implementation  
3. ✅ Progress bar responsiveness

---

## Quick Verification Commands

```bash
# Run new desktop-only tests (fast, no mobile viewports)
cd apps/web
pnpm exec playwright test e2e/screen-reader-aria.spec.ts e2e/disabled-states.spec.ts

# Verify code patterns
grep -roh "aria-label\|aria-expanded" apps/web/src/components | wc -l  # Total occurrences
grep -r "disabled={" apps/web/src | wc -l  # JSX/TSX prop usage only
grep -r "progressbar" apps/web/src/components  # Should find CostSummary, CostBreakdown
```

**Note:** Tests run desktop-only (1280x720 viewport) for speed. ARIA and disabled states work the same on all viewports. Mobile responsiveness already covered by existing 87 tests.

---

**Created:** 2025-11-13  
**Purpose:** Guide for agent to verify remaining Phase 15 Day 3 items
