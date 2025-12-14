# Recipe Slot App Repository Analysis

## Summary

**Location:** `/mnt/d/dev/recipe-for-flutter/recipe_slot_app`

---

## 1. Overall Structure

```
recipe_slot_app/
├── app/                          # Next.js 14 web dashboard (WORKING)
│   ├── app/                      # App Router (pages, API routes)
│   ├── components/               # React UI components
│   ├── lib/                      # Utilities (db, types, utils)
│   ├── prisma/                   # Database schema
│   └── package.json              # Next.js dependencies
├── lib/                          # Flutter app source code
├── android/                      # Android native (Kotlin)
├── ios/                          # iOS native (Swift)
├── pubspec.yaml                  # Flutter dependencies
└── [21 .md documentation files]
```

---

## 2. Next.js Webapp Status: WORKING & MATURE

- Next.js 14.2.28 with TypeScript
- Prisma ORM (v6.7.0)
- NextAuth 4 for authentication
- 99 TypeScript/TSX files
- Tailwind CSS + Radix UI
- 17+ API endpoints

---

## 3. Flutter App Status: EXISTS BUT NEEDS UPDATE

- Flutter SDK 3.0.0+
- 18 Dart files (well-organized)
- Uses: riverpod, dio, hive, lottie, go_router
- Architecture: screens, models, services, providers, widgets, theme

---

## 4. Documentation (21 .md files) - GOLDMINE!

**Critical for RAG:**
1. `SAAS_TECHNICAL_SPECIFICATIONS.md` (1781 lines) - Complete architecture
2. `FEATURE_PORTING_SPECIFICATIONS.md` (1586 lines) - Feature specs
3. `WEB_TO_MOBILE_MAPPING.md` (26925 bytes) - File-by-file mapping
4. `MOBILE_PARITY_MASTER_PLAN.md` (520 lines) - Development roadmap
5. `FLUTTER_PROJECT_GUIDE.md` - Mobile implementation guide

---

## 5. File Type Breakdown

| Type | Count | Purpose |
|------|-------|---------|
| TSX | 76 | React components |
| TS | 32 | TypeScript utilities |
| Dart | 19 | Flutter app |
| MD | 21 | Documentation |
| YAML | 2 | Config files |

---

## 6. Ingestion Priority for RAG

**HIGH (must ingest):**
- SAAS_TECHNICAL_SPECIFICATIONS.md
- FEATURE_PORTING_SPECIFICATIONS.md
- WEB_TO_MOBILE_MAPPING.md
- FLUTTER_PROJECT_GUIDE.md
- All TSX/TS files in app/
- All Dart files in lib/
- pubspec.yaml, package.json

**MEDIUM (helpful context):**
- README.md
- MOBILE_PARITY_MASTER_PLAN.md
- Prisma schema
- TODO.md

---

## Key Insight

You already have EXTENSIVE documentation that would be incredibly valuable for RAG:
- Technical specs
- Feature mapping
- Porting guides
- Architecture decisions

This is better documentation than most projects. Once ingested, your coding agent will have deep context on exactly how to build the Flutter SaaS.
