# Mobile Recipe Expansion Roadmap

> **Status:** Planning Phase
> **Target:** Complete Core Architecture Guide (Custom Stack)

## Overview

This roadmap defines the plan to expand the `docs/recipes/mobile` collection. It is tailored to the project's specific technology stack: **Flutter + Riverpod + GoRouter + Supabase + Hive**.

## New Recipe Specifications

---

### 1. State Management with Riverpod

**Target File:** `flutter_state_management_riverpod.md`
**Priority:** High

**Goal:** Provide a standard pattern for state management using Riverpod 2.x code generation.

**Tech Stack:**

- `flutter_riverpod`
- `riverpod_annotation`
- `freezed_annotation`

**Key Sections:**

- **Architecture:** Notifier vs AsyncNotifier.
- **Data Flow:** Injecting Repositories -> Providers -> UI.
- **Code Gen:** Using `build_runner` for robust providers.
- **Testing:** Unit testing notifiers.

---

### 2. Advanced Navigation with GoRouter

**Target File:** `flutter_navigation_gorouter.md`
**Priority:** High

**Goal:** Implement robust routing with Auth guards and Deep links.

**Tech Stack:**

- `go_router`

**Key Sections:**

- **Routing Tree:** Organization of routes.
- **Auth Guards:** Redirecting unauthenticated users (linked to Riverpod auth state).
- **ShellRoute:** Bottom navigation persistence.
- **Deep Linking:** Handling incoming links from Supabase/Email.

---

### 3. Type-Safe Networking (Dio + Retrofit)

**Target File:** `flutter_networking_retrofit.md`
**Priority:** Medium

**Goal:** Create a scalable, type-safe API client layer.

**Tech Stack:**

- `dio`
- `retrofit`
- `json_serializable`

**Key Sections:**

- **Client Setup:** Singleton Dio instance with interceptors.
- **Interceptors:** Auth headers (Supabase tokens), logging, error handling.
- **API Definition:** Retrofit interfaces for concise API calls.
- **Error Mapping:** Converting HTTP errors to domain exceptions.

---

### 4. Local-First Data with Hive

**Target File:** `flutter_local_data_hive.md`
**Priority:** Medium

**Goal:** Implement offline caching and local data storage using Hive.

**Tech Stack:**

- `hive`
- `hive_flutter`

**Key Sections:**

- **Storage Strategy:** Boxes vs. LazyBoxes.
- **Adapters:** Registering TypeAdapters multiple models.
- **Sync Strategy:** Caching API responses for offline use.
- **Security:** Encrypting sensitive boxes.

---

### 5. Analytics & Monitoring

**Target File:** `flutter_analytics_monitoring.md`
**Priority:** Low

**Goal:** Unified pipeline for events, analytics, and crash reporting.

**Tech Stack:**

- `firebase_crashlytics` (Errors)
- `rudderstack` or `segment_flutter` (Events)

**Key Sections:**

- **Error Tracking:** Wiring up runZonedGuarded + Crashlytics.
- **Event Tracking:** Abstraction layer for analytics events.
- **User Identification:** Linking Auth users to Analytics identities.

---

### 6. CI/CD Pipeline

**Target File:** `flutter_ci_cd_github_actions.md`
**Priority:** Low

**Goal:** Automate builds and checks.

**Tech Stack:**

- GitHub Actions
- Fastlane (optional)

**Key Sections:**

- **Checks:** Analyze, Format, Test.
- **Secrets:** Managing keys securely.
- **Builds:** Compiling APK/IPA artifacts.

## Execution Checklist

- [ ] Create `flutter_state_management_riverpod.md`
- [ ] Create `flutter_navigation_gorouter.md`
- [ ] Create `flutter_networking_retrofit.md`
- [ ] Create `flutter_local_data_hive.md`
- [ ] Create `flutter_analytics_monitoring.md`
- [ ] Create `flutter_ci_cd_github_actions.md`
