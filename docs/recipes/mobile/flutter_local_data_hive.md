---
title: "Flutter Local Data with Hive"
platform: mobile
framework: flutter
feature_tags:
  - database
  - offline
usage_tier: recipe
framework_version: "3.24.x"
tech_stack:
  - hive
  - hive_flutter
  - hive_generator
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "hive 2.2.3"
  - "hive_flutter 1.1.0"
---

# Flutter Local Data with Hive

> **Summary:** Implement fast, offline-first local- **Storage Strategy:** Boxes vs. LazyBoxes.
- **Adapters:** Registering TypeAdapters for multiple models.
- **Sync Strategy:** Caching API responses for offline use. datasets, and secure encryption.

## Prerequisites

- [ ] `build_runner` for generating adapters

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| hive | ^2.2.3 | NoSQL Database |
| hive_flutter | ^1.1.0 | Flutter helpers |

## Step-by-Step Implementation

### 1. Initialize Hive

Initialize Hive in `main.dart` before `runApp`.

```dart
// lib/main.dart
import 'package:hive_flutter/hive_flutter.dart';

void main() async {
  await Hive.initFlutter();
  
  // Register Adapters
  Hive.registerAdapter(UserAdapter());
  
  // Open Boxes
  await Hive.openBox('settings');
  await Hive.openBox<User>('users');

  runApp(const MyApp());
}
```

### 2. Define Types & Adapters

```dart
// lib/features/users/models/user.dart
import 'package:hive/hive.dart';

part 'user.g.dart';

@HiveType(typeId: 0)
class User extends HiveObject {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String name;

  User({required this.id, required this.name});
}
```

Run generation:

```bash
flutter pub run build_runner build
```

### 3. Service Layer (Riverpod)

Create a service to abstract Hive operations.

```dart
// lib/core/storage/storage_service.dart
import 'package:hive_flutter/hive_flutter.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'storage_service.g.dart';

class StorageService {
  final Box _settingsBox = Hive.box('settings');
  
  bool get isDarkMode => _settingsBox.get('darkMode', defaultValue: false);
  
  Future<void> setDarkMode(bool value) async {
    await _settingsBox.put('darkMode', value);
  }
}

@Riverpod(keepAlive: true)
StorageService storageService(StorageServiceRef ref) {
  return StorageService();
}
```

### 4. Encrypted Box

For sensitive data (like tokens), use an encrypted box.

**Note:** You must store the encryption key securely using `flutter_secure_storage`.

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// Generate or retrieve key
final secureStorage = FlutterSecureStorage();
var keyStr = await secureStorage.read(key: 'hive_key');
if (keyStr == null) {
  final key = Hive.generateSecureKey();
  await secureStorage.write(key: 'hive_key', value: base64UrlEncode(key));
  keyStr = base64UrlEncode(key);
}

final key = base64UrlDecode(keyStr!);
await Hive.openBox('secureBox', encryptionCipher: HiveAesCipher(key));
```

## Common Pitfalls

### 1. Changing TypeIds

**Problem:** Changing `typeId` or `@HiveField` indices breaks existing data.

**Solution:** Never change existing ids. Add new fields with new indices. Indices don't need to be sequential.

### 2. Bloating Main Thread

**Problem:** Reading large lists from a regular `Box` loads everything into memory.

**Solution:** Use `LazyBox` for large datasets. It loads values only when requested.

```dart
final lazyBox = await Hive.openLazyBox('largeData');
final value = await lazyBox.get('key'); // Await required
```

## Alternatives

### Shared Preferences

**When to use:** Simple flags only. Hive is much faster and supports better types.

### SQLite (Drift)

**When to use:** Complex relational queries are needed. Hive is Key-Value only.
