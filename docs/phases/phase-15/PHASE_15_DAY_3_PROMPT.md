# Phase 15 Day 3 - Frontend Polish Prompt

**Task:** Polish all Phase 11-14 UI components for production quality  
**GitHub Issue:** [#69 - Frontend Polish - Visual Consistency & Mobile Responsive](https://github.com/Beaulewis1977/synthesis/issues/69)  
**Time Estimate:** 6-8 hours  
**Priority:** MEDIUM

---

## 📚 Required Reading (Read First)

1. `docs/phases/phase-15/PHASE_15_AGENT_PROMPT.md` - **Quick start overview** (context and warnings)
2. `docs/phases/phase-15/00_PHASE_15_OVERVIEW.md` - Phase scope
3. `docs/phases/phase-15/04_BUILD_PLAN.md` - **Day 3 section** (lines 119-171)
4. `docs/phases/phase-15/05_ACCEPTANCE_CRITERIA.md` - **Issue #69 section**
5. GitHub Issue #69: https://github.com/Beaulewis1977/synthesis/issues/69

---

## 🎯 Day 3 Objectives

Polish all Phase 11-14 UI additions to production quality: consistent design, mobile responsive (320px width), accessible (WCAG AA), and professional.

---

## ✅ Tasks

### Morning: Phase 11-12 UI Polish (3-4 hours)

**Phase 11 Components (Trust Badges & Recency Indicators):**
- [ ] Standardize badge sizing and colors (match design system)
- [ ] Add hover tooltips explaining trust levels
- [ ] Mobile responsive (stack badges vertically on narrow screens)
- [ ] Add smooth fade-in animations when loading
- [ ] Ensure colors match design system (green=official, blue=verified)

**Phase 12 Components (Cost Dashboard & Synthesis View):**
- [ ] Cost Dashboard (`/costs` page):
  - Responsive layout (sidebar collapses on mobile)
  - Animate progress bars smoothly
  - Chart labels readable on small screens
  - Loading skeletons while fetching data
  - Alert colors consistent (yellow=warning, red=limit)
- [ ] Synthesis View (Search results toggle):
  - Toggle button has clear active state
  - Approach cards use consistent spacing
  - Stars (⭐) render correctly on all devices
  - Contradiction boxes stand out (yellow background)
  - Sources list expandable with smooth animation
  - Mobile: Single column layout for approaches

### Afternoon: Phase 13-14 UI Polish (2-3 hours)

**Phase 13 Components (Related Files Panel):**
- [ ] Panel opens/closes with smooth slide animation
- [ ] File links have hover state (underline + color)
- [ ] Icons consistent (📦 imports, 📝 tests, 👥 siblings)
- [ ] Mobile: Panel doesn't break layout
- [ ] Long file paths truncate with ellipsis
- [ ] "Show more" button styled consistently

**Phase 14 Components (Tech Stack Filter):**
- [ ] Filter chips mobile responsive
- [ ] Touch targets ≥44px for buttons
- [ ] Clear visual feedback when selected
- [ ] Proper spacing and alignment

### Evening: Cross-Cutting Polish (1 hour)

**Design System Consistency:**
- [ ] Verify all components use same color palette
- [ ] Typography consistent (font sizes, weights)
- [ ] Spacing follows 8px grid system
- [ ] Borders and shadows match existing UI
- [ ] Loading states everywhere (skeletons/spinners)
- [ ] Error boundaries and toast notifications

**Accessibility:**
- [ ] All interactive elements keyboard navigable (Tab, Enter, Escape)
- [ ] Focus indicators visible
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast ≥4.5:1 (WCAG AA)
- [ ] Screen reader tested (NVDA/VoiceOver)

---

## 🔍 Commands

```bash
# Run frontend tests
pnpm --filter @synthesis/web test

# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Lighthouse audit (for accessibility and performance)
lighthouse http://localhost:3000

# Visual regression testing (if configured)
npm run test:visual

# Accessibility testing
npm run test:a11y
```

---

## ✨ Success Criteria

- ✅ Lighthouse score >90
- ✅ Mobile responsive (works on 320px width - iPhone SE)
- ✅ WCAG AA compliant (color contrast ≥4.5:1)
- ✅ Visual consistency achieved (single design system)
- ✅ All components use same color palette
- ✅ Typography consistent throughout
- ✅ Touch targets ≥44px for mobile
- ✅ Keyboard navigation works everywhere
- ✅ Loading states implemented
- ✅ Error boundaries in place

---

## 📖 Reference Documentation

- Issue #69 body: Detailed polish requirements and design system checklist
- Phase 11-14 docs: Component implementation details
- Design system: Check existing components for patterns
- Accessibility: WCAG AA guidelines

---

## 🎨 Design System Checklist

**Colors:**
- Primary: `#3B82F6` (blue)
- Success: `#10B981` (green)
- Warning: `#F59E0B` (yellow)
- Error: `#EF4444` (red)
- Gray scale: `#F3F4F6` to `#1F2937`

**Typography:**
- Headings: `font-bold` from `text-xl` to `text-3xl`
- Body: `text-base` or `text-sm`
- Captions: `text-xs text-gray-600`
- Line height: 1.5 for body, 1.2 for headings

**Spacing:**
- Padding/margin: multiples of 4 (`p-2`, `p-4`, `p-6`)
- Component gaps: `space-y-4` or `gap-4`
- Section spacing: `mb-8` or `mb-12`

**Animations:**
- Duration: 150-300ms for micro-interactions
- Easing: `ease-in-out` for most transitions
- No animation if `prefers-reduced-motion`

---

## ⚠️ Important Notes

- **Test on real devices:** Use Chrome DevTools device emulation, but also test on real mobile devices
- **Accessibility first:** Ensure keyboard navigation and screen reader compatibility
- **Progressive enhancement:** Polish should enhance, not break existing functionality
- **Consistency is key:** All components should feel like part of the same system
- **Mobile-first:** Test mobile layout first, then desktop

---

**Start with Phase 11 components, then Phase 12, then Phase 13-14, finally cross-cutting polish. See `04_BUILD_PLAN.md` Day 3 section for detailed breakdown.**

