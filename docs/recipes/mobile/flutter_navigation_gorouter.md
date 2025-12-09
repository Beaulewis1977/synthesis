---
title: "Flutter Navigation with GoRouter"
platform: mobile
framework: flutter
feature_tags:
  - navigation
  - deep_linking
usage_tier: recipe
framework_version: "3.24.x"
tech_stack:
  - go_router
  - flutter_riverpod
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "go_router 14.2.0"
---

# Flutter Navigation with GoRouter

> **Summary:** Implement declarative routing using GoRouter. Covers defining routes, handling auth redirection (Guards), persistent bottom navigation (`ShellRoute`), and deep linking.

## Prerequisites

- [ ] Flutter SDK 3.24.x
- [ ] `flutter_riverpod` (for auth state integration)

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| go_router | ^14.2.0 | Routing package |

## Step-by-Step Implementation

### 1. Define Routes & Provider

Create a `routerProvider` that watches your Auth State. This ensures the router "refreshes" (re-evaluates redirects) whenever the user logs in or out.

```dart
// lib/router/router.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../features/auth/providers/auth_provider.dart';
import '../features/home/home_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/home/details_screen.dart';

part 'router.g.dart';

// Private key to get context for SnackBar etc without context
final _rootNavigatorKey = GlobalKey<NavigatorState>();

@riverpod
GoRouter router(RouterRef ref) {
  // Watch auth state to trigger redirect logic
  final authState = ref.watch(authProvider);
  
  // IMPORTANT: refreshListenable requires a Listenable (ChangeNotifier/ValueNotifier)
  // Riverpod providers are NOT Listenables. Use one of these approaches:
  // Option A: Create a ValueNotifier bridge (shown below)
  // Option B: Use ref.listen() to call router.refresh() imperatively
  // Option C: Have your AuthNotifier extend ChangeNotifier
  final refreshNotifier = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, __) => refreshNotifier.value++);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    refreshListenable: refreshNotifier, // ValueNotifier bridge for Riverpod
    
    // Redirect logic
    redirect: (context, state) {
      final isLoggedIn = authState.user != null;
      final isLoggingIn = state.uri.path == '/login';

      if (!isLoggedIn && !isLoggingIn) return '/login';
      if (isLoggedIn && isLoggingIn) return '/';

      return null; // No redirect
    },

    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
        routes: [
          GoRoute(
            path: 'details/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return DetailsScreen(id: id);
            },
          ),
        ],
      ),
    ],
  );
}
```

### 2. Persistent Bottom Navigation (ShellRoute)

Use `ShellRoute` (or `StatefulShellRoute` for preserving state) to keep a navigation bar visible while switching screens.

```dart
// Inside routes: []
StatefulShellRoute.indexedStack(
  builder: (context, state, navigationShell) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: navigationShell.goBranch,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  },
  branches: [
    StatefulShellBranch(
      routes: [
        GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
      ],
    ),
    StatefulShellBranch(
      routes: [
        GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen()),
      ],
    ),
  ],
),
```

### 3. Connect to App

```dart
// lib/main.dart
class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goRouter = ref.watch(routerProvider);

    return MaterialApp.router(
      routerConfig: goRouter,
      title: 'My App',
    );
  }
}
```

## Common Pitfalls

### 1. Infinite Redirect Loop

**Problem:** Redirect logic keeps sending user to `/login` which redirects to `/login`...

**Solution:** Always check if the user is *already* at the target location.

```dart
final isLoggingIn = state.uri.path == '/login';
if (!isLoggedIn && !isLoggingIn) return '/login';
```

### 2. Context across Async Gaps

**Problem:** Using `BuildContext` after an `await` call to navigate.

**Solution:** Dart now supports `use_build_context_synchronously` lint. Check `context.mounted` before navigating.

```dart
await someAsyncCall();
if (context.mounted) {
  context.go('/next');
}
```

## Alternatives

### AutoRoute

**Trade-offs:**

- Pro: Strongly typed arguments generated automatically.
- Con: More boilerplate setup than GoRouter.

## Related Recipes

- [State Management with Riverpod](./flutter_state_management_riverpod.md)
