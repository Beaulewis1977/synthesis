---
title: "Type-Safe Networking with Dio + Retrofit"
platform: mobile
framework: flutter
feature_tags:
  - networking
  - api
usage_tier: recipe
framework_version: "3.24.x"
tech_stack:
  - dio
  - retrofit
  - json_serializable
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "dio 5.5.0"
  - "retrofit 4.1.0"
---

# Type-Safe Networking with Dio + Retrofit

> **Summary:** Create a robust API layer using Dio for HTTP transport and Retrofit for type-safe interface generation. Includes interceptors for auth tokens and global error handling.

## Prerequisites

- [ ] `build_runner` installed (comes via dev dependency)

## Installation

Add the following to your `pubspec.yaml`:

```yaml
dependencies:
  dio: ^5.5.0
  retrofit: ^4.1.0
  json_annotation: ^4.9.0

dev_dependencies:
  build_runner: ^2.4.0
  json_serializable: ^6.7.0
  retrofit_generator: ^7.0.0
```

Then run:

```bash
flutter pub get
dart run build_runner build
```

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| dio | ^5.5.0 | HTTP Client |
| retrofit | ^4.1.0 | Type-Safe API Client |
| json_annotation | ^4.9.0 | JSON Helpers |
| json_serializable | ^6.7.0 | JSON Code Generator (dev) |
| retrofit_generator | ^7.0.0 | Retrofit Code Generator (dev) |

## Step-by-Step Implementation

### 1. Setup Dio Instance (Provider)

Create a configured Dio instance with base URL and interceptors.

```dart
// lib/core/network/dio_provider.dart
import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'dio_provider.g.dart';

@Riverpod(keepAlive: true)
Dio dio(DioRef ref) {
  final dio = Dio(BaseOptions(
    baseUrl: 'https://api.myapp.com/v1',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  // Add Auth Interceptor
  // See [State Management with Riverpod](./flutter_state_management_riverpod.md) for authProvider setup
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      // Fetch token from auth state (Riverpod example)
      final authState = ref.read(authProvider);
      if (authState is AsyncData) {
        final token = authState.value?.accessToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
      }
      return handler.next(options);
    },
    onError: (DioException e, handler) {
      // Global error handling (e.g. log out on 401)
      if (e.response?.statusCode == 401) {
        // Trigger logout and redirect
        ref.read(authProvider.notifier).logout();
        // Reject to prevent further retries
        return handler.reject(e);
      }
      return handler.next(e);
    },
  ));

  return dio;
}
```

### 2. Define Data Model

```dart
// lib/features/users/models/user.dart
import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

@JsonSerializable()
class User {
  final String id;
  final String username;
  final String email;

  User({required this.id, required this.username, required this.email});

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  Map<String, dynamic> toJson() => _$UserToJson(this);
}
```

### 3. Define API Interface (Retrofit)

```dart
// lib/core/api/api_client.dart
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import '../../features/users/models/user.dart';

part 'api_client.g.dart';

@RestApi()
abstract class ApiClient {
  factory ApiClient(Dio dio, {String baseUrl}) = _ApiClient;

  @GET('/users/{id}')
  Future<User> getUser(@Path('id') String id);

  @POST('/users')
  Future<User> createUser(@Body() User user);
  
  @PUT('/users/{id}')
  Future<User> updateUser(@Path() String id, @Body() Map<String, dynamic> body);
}
```

### 4. Provide API Client

```dart
@riverpod
ApiClient apiClient(ApiClientRef ref) {
  final dio = ref.watch(dioProvider);
  return ApiClient(dio);
}
```

## Common Pitfalls

### 1. Missing Content-Type

**Problem:** API returns 415 or parses body incorrectly.

**Solution:** Dio sets `application/json` by default if data is a Map/List. For FormData, it sets `multipart/form-data`. Ensure your `@Body()` matches.

### 2. Timeout Exceptions

**Problem:** Default timeouts might be infinite or too short.

**Solution:** Always configure `connectTimeout` and `receiveTimeout` in `BaseOptions`.

## Related Recipes

- [State Management with Riverpod](./flutter_state_management_riverpod.md) - Use `AsyncValue` to handle API states (loading/error/data).
