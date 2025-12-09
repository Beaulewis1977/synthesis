---
title: "Flutter Analytics & Monitoring"
platform: mobile
framework: flutter
feature_tags:
  - analytics
  - monitoring
usage_tier: recipe
framework_version: "3.24.x"
tech_stack:
  - firebase_crashlytics
  - segment_flutter (or rudderstack)
difficulty: beginner
last_updated: 2025-12-08
recommended: true
---

# Flutter Analytics & Monitoring

> **Summary:** Setup a production-grade observability pipeline. Catch errors with Firebase Crashlytics and track user behavior with Segment (or Rudderstack).

## Prerequisites

- [ ] Firebase Project Setup
- [ ] Segment/Rudderstack Source Write Key

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| firebase_crashlytics | ^3.4.19 | Crash Reporting |
| segment_analytics | ^2.3.0 | Event Tracking |

## Step-by-Step Implementation

### 1. Initialize Analytics Client

Initialize Segment (or Rudderstack) before your app run.

```dart
// lib/main.dart
import 'package:segment_analytics/segment_analytics.dart';

void main() async {
  /* ... Initialize Firebase ... */
  
  // Setup Segment
  await Segment.setup(
    Configuration(
      writeKey: 'YOUR_SEGMENT_WRITE_KEY',
      trackApplicationLifecycleEvents: true,
    ),
  );

  // Pass all uncaught "fatal" errors from the framework to Crashlytics
  FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;

  runZonedGuarded(() {
    runApp(const MyApp());
  }, (error, stack) {
    // Pass all uncaught asynchronous errors that aren't handled by the Flutter framework to Crashlytics
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  });
}
```

### 2. Analytics Service

Create an abstraction for analytics so you can swap providers later (e.g. Segment to Amplitude) without changing app code.

```dart
// lib/core/analytics/analytics_service.dart
import 'package:flutter/foundation.dart';
import 'package:segment_analytics/segment_analytics.dart';

class AnalyticsService {
  void trackEvent(String name, [Map<String, dynamic>? properties]) {
    // Segment Implementation
    Segment.track(
      eventName: name,
      properties: properties,
    );
    
    if (kDebugMode) {
      print('Track: $name, $properties');
    }
  }

  void identifyUser(String userId, [Map<String, dynamic>? traits]) {
    Segment.identify(
      userId: userId,
      traits: traits,
    );
    
    if (kDebugMode) {
      print('Identify: $userId, $traits');
    }
  }
}
```

### 3. Tracking Navigation Events

With GoRouter, you can track screen views automatically using a `NavigatorObserver`.

```dart
// Option 1: Firebase Analytics (if installed)
FirebaseAnalyticsObserver(analytics: FirebaseAnalytics.instance),

// Option 2: Custom Observer for Segment
class SegmentObserver extends NavigatorObserver {
  final AnalyticsService analyticsService;
  
  SegmentObserver(this.analyticsService);
  
  @override
  void didPush(Route route, Route? previousRoute) {
    if (route.settings.name != null) {
      analyticsService.trackEvent('screen_view', {'name': route.settings.name});
    }
  }
}

// Usage with GoRouter (using Riverpod):
// GoRouter(
//   observers: [SegmentObserver(ref.watch(analyticsServiceProvider))],
//   ...
// )
```

### 4. Providing AnalyticsService

```dart
// lib/core/analytics/analytics_service_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'analytics_service.dart';

part 'analytics_service_provider.g.dart';

@riverpod
AnalyticsService analyticsService(AnalyticsServiceRef ref) {
  return AnalyticsService();
}
```

## Common Pitfalls

### 1. Missing dSYM files (iOS)

**Problem:** Crashlytics dashboard shows "Missing dSYM" and obfuscated stack traces.

**Solution:** In Xcode Build Phases, ensure the "Run Script" for Crashlytics is present and you are uploading dSYMs via Fastlane or manually.

### 2. Not Identifying Users

**Problem:** Analytics events are anonymous even after login.

**Solution:** Call `identifyUser(uid)` immediately after a successful login in your Auth logic.
