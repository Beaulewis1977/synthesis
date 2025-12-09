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

- [ ] `build_runner` installed

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| dio | ^5.5.0 | HTTP Client |
| retrofit | ^4.1.0 | API Interface Generator |
| json_annotation | ^4.9.0 | JSON Helpers |

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
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      // Fetch token from Supabase/SecureStorage
      const token = '...'; // ref.read(authProvider).token
      if (token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      return handler.next(options);
    },
    onError: (DioException e, handler) {
      // Global error handling (e.g. log out on 401)
      if (e.response?.statusCode == 401) {
        // ref.read(authProvider.notifier).logout();
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
