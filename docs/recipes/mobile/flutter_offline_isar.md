---
title: "Flutter Offline-First with Isar"
platform: mobile
framework: flutter
framework_version: "3.24.x"
feature_tags:
  - offline
  - local_storage
  - sync
usage_tier: recipe
tech_stack:
  - isar
  - flutter
difficulty: intermediate
last_updated: 2025-11-30
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "isar 4.0.0-dev.14"
  - "isar_flutter_libs 4.0.0-dev.14"
---

# Flutter Offline-First with Isar

> **Summary:** Build offline-first Flutter apps using Isar, a fast NoSQL database. This recipe covers local data persistence, sync queue patterns, conflict resolution, and seamlessly handling online/offline transitions.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK 3.24.x or later installed
- [ ] Basic understanding of Dart isolates and async programming
- [ ] A backend API for syncing (optional, for sync pattern)
- [ ] Understanding of data modeling concepts

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.24.x | UI framework |
| isar | ^4.0.0-dev.14 | NoSQL database |
| isar_flutter_libs | ^4.0.0-dev.14 | Platform bindings |
| connectivity_plus | ^6.0.0 | Network status monitoring |
| path_provider | ^2.1.0 | Database path resolution |

## Step-by-Step Implementation

### 1. Project Setup

Add Isar packages to your project:

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  isar: ^4.0.0-dev.14
  isar_flutter_libs: ^4.0.0-dev.14
  connectivity_plus: ^6.0.0
  path_provider: ^2.1.0
  shared_preferences: ^2.2.2

dev_dependencies:
  build_runner: ^2.4.0
  isar_generator: ^4.0.0-dev.14
```

```bash
flutter pub get
```

### 2. Define Your Data Models

Create Isar collections with the `@collection` annotation:

```dart
// lib/models/task.dart
import 'package:isar/isar.dart';

part 'task.g.dart';

@collection
class Task {
  Id id = Isar.autoIncrement;

  @Index()
  late String title;

  String? description;

  @Index()
  late DateTime createdAt;

  DateTime? updatedAt;

  @Index()
  bool isCompleted = false;

  // Sync metadata
  @Index()
  SyncStatus syncStatus = SyncStatus.synced;

  String? remoteId;  // ID from backend
  DateTime? lastSyncedAt;
}

enum SyncStatus {
  synced,     // In sync with server
  pending,    // Created/updated locally, needs sync
  conflict,   // Conflict detected during sync
  deleted,    // Marked for deletion
}
```

Generate the Isar schema:

```bash
dart run build_runner build
```

### 3. Initialize Isar Database

Create a database service for initialization and access:

```dart
// lib/services/database_service.dart
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import '../models/task.dart';

class DatabaseService {
  static Isar? _isar;

  static Isar get instance {
    if (_isar == null) {
      throw StateError('Database not initialized. Call initialize() first.');
    }
    return _isar!;
  }

  static Future<void> initialize() async {
    if (_isar != null) return;

    final dir = await getApplicationDocumentsDirectory();

    _isar = Isar.open(
      schemas: [TaskSchema],
      directory: dir.path,
      name: 'app_database',
    );
  }

  static Future<void> close() async {
    await _isar?.close();
    _isar = null;
  }
}
```

Initialize in your app:

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'services/database_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await DatabaseService.initialize();

  runApp(const MyApp());
}
```

### 4. Create a Repository for CRUD Operations

Implement the repository pattern for clean data access:

```dart
// lib/repositories/task_repository.dart
import 'package:isar/isar.dart';
import '../models/task.dart';
import '../services/database_service.dart';

class TaskRepository {
  Isar get _isar => DatabaseService.instance;

  // Create
  Future<Task> createTask({
    required String title,
    String? description,
  }) async {
    final task = Task()
      ..title = title
      ..description = description
      ..createdAt = DateTime.now()
      ..syncStatus = SyncStatus.pending;

    await _isar.writeAsync((isar) {
      isar.tasks.put(task);
    });

    return task;
  }

  // Read single
  Future<Task?> getTask(int id) async {
    return _isar.tasks.get(id);
  }

  // Read all
  Future<List<Task>> getAllTasks() async {
    return _isar.tasks.where().findAll();
  }

  // Read with filter
  Future<List<Task>> getIncompleteTasks() async {
    return _isar.tasks
        .filter()
        .isCompletedEqualTo(false)
        .sortByCreatedAtDesc()
        .findAll();
  }

  // Update
  Future<Task> updateTask(Task task) async {
    task.updatedAt = DateTime.now();
    task.syncStatus = SyncStatus.pending;

    await _isar.writeAsync((isar) {
      isar.tasks.put(task);
    });

    return task;
  }

  // Toggle completion
  Future<Task> toggleTaskCompletion(int id) async {
    final task = await _isar.tasks.get(id);
    if (task == null) throw Exception('Task not found');

    task.isCompleted = !task.isCompleted;
    task.updatedAt = DateTime.now();
    task.syncStatus = SyncStatus.pending;

    await _isar.writeAsync((isar) {
      isar.tasks.put(task);
    });

    return task;
  }

  // Soft delete (mark for sync)
  Future<void> deleteTask(int id) async {
    final task = await _isar.tasks.get(id);
    if (task == null) return;

    if (task.remoteId == null) {
      // Never synced, safe to hard delete
      await _isar.writeAsync((isar) {
        isar.tasks.delete(id);
      });
    } else {
      // Mark for deletion sync
      task.syncStatus = SyncStatus.deleted;
      await _isar.writeAsync((isar) {
        isar.tasks.put(task);
      });
    }
  }

  // Watch for changes (reactive)
  Stream<List<Task>> watchAllTasks() {
    return _isar.tasks
        .where()
        .watch(fireImmediately: true);
  }

  Stream<List<Task>> watchIncompleteTasks() {
    return _isar.tasks
        .filter()
        .isCompletedEqualTo(false)
        .watch(fireImmediately: true);
  }

  // Get pending sync items
  Future<List<Task>> getPendingSyncTasks() async {
    return _isar.tasks
        .filter()
        .syncStatusEqualTo(SyncStatus.pending)
        .or()
        .syncStatusEqualTo(SyncStatus.deleted)
        .findAll();
  }
}
```

### 5. Implement Sync Service

Create a sync service to handle online/offline synchronization:

```dart
// lib/services/sync_service.dart
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:isar/isar.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/task.dart';
import '../models/exceptions.dart';
import '../repositories/task_repository.dart';
import 'database_service.dart';
import 'api_service.dart';

class SyncService {
  final TaskRepository _taskRepository;
  final ApiService _apiService;
  final Connectivity _connectivity = Connectivity();
  static const _lastSyncKey = 'last_sync_timestamp';

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _isSyncing = false;

  SyncService({
    required TaskRepository taskRepository,
    required ApiService apiService,
  })  : _taskRepository = taskRepository,
        _apiService = apiService;

  void startListening() {
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen(
      (results) {
        final isOnline = results.any((r) => r != ConnectivityResult.none);
        if (isOnline) {
          syncAll();
        }
      },
    );
  }

  void stopListening() {
    _connectivitySubscription?.cancel();
  }

  Future<SyncResult> syncAll() async {
    if (_isSyncing) return SyncResult(synced: 0, failed: 0, conflicts: 0);

    _isSyncing = true;
    int synced = 0;
    int failed = 0;
    int conflicts = 0;

    try {
      // 1. Push local changes to server
      final pendingTasks = await _taskRepository.getPendingSyncTasks();

      for (final task in pendingTasks) {
        try {
          if (task.syncStatus == SyncStatus.deleted) {
            await _syncDelete(task);
          } else {
            await _syncTask(task);
          }
          synced++;
        } on ConflictException catch (e) {
          await _handleConflict(task, e.serverVersion);
          conflicts++;
        } catch (e) {
          failed++;
        }
      }

      // 2. Pull server changes
      await _pullServerChanges();

    } finally {
      _isSyncing = false;
    }

    return SyncResult(synced: synced, failed: failed, conflicts: conflicts);
  }

  Future<void> _syncTask(Task task) async {
    if (task.remoteId == null) {
      // Create on server
      final remoteTask = await _apiService.createTask(task);
      task.remoteId = remoteTask.id;
      task.syncStatus = SyncStatus.synced;
      task.lastSyncedAt = DateTime.now();
    } else {
      // Update on server
      await _apiService.updateTask(task);
      task.syncStatus = SyncStatus.synced;
      task.lastSyncedAt = DateTime.now();
    }

    final isar = DatabaseService.instance;
    await isar.writeAsync((isar) {
      isar.tasks.put(task);
    });
  }

  Future<void> _syncDelete(Task task) async {
    if (task.remoteId != null) {
      await _apiService.deleteTask(task.remoteId!);
    }

    final isar = DatabaseService.instance;
    await isar.writeAsync((isar) {
      isar.tasks.delete(task.id);
    });
  }

  Future<void> _pullServerChanges() async {
    final lastSync = await _getLastSyncTimestamp();
    final serverTasks = await _apiService.getTasksSince(lastSync);

    final isar = DatabaseService.instance;

    for (final serverTask in serverTasks) {
      final localTask = await isar.tasks
          .filter()
          .remoteIdEqualTo(serverTask.remoteId)
          .findFirst();

      if (localTask == null) {
        // New from server
        await isar.writeAsync((isar) {
          isar.tasks.put(serverTask);
        });
      } else if (localTask.syncStatus == SyncStatus.synced) {
        // Safe to update from server
        serverTask.id = localTask.id;
        await isar.writeAsync((isar) {
          isar.tasks.put(serverTask);
        });
      }
      // Skip if local has pending changes (handled in push)
    }

    await _saveLastSyncTimestamp(DateTime.now());
  }

  Future<void> _handleConflict(Task localTask, Task serverTask) async {
    // Strategy: Last-write-wins with user notification
    // Alternative strategies: Server-wins, Client-wins, Manual resolution

    final localUpdated = localTask.updatedAt ?? localTask.createdAt;
    final serverUpdated = serverTask.updatedAt ?? serverTask.createdAt;

    final isar = DatabaseService.instance;

    if (localUpdated.isAfter(serverUpdated)) {
      // Local wins - force push
      await _apiService.updateTask(localTask, force: true);
      localTask.syncStatus = SyncStatus.synced;
      localTask.lastSyncedAt = DateTime.now();
    } else {
      // Server wins - update local
      serverTask.id = localTask.id;
      serverTask.syncStatus = SyncStatus.synced;
      serverTask.lastSyncedAt = DateTime.now();
    }

    await isar.writeAsync((isar) {
      isar.tasks.put(localTask.syncStatus == SyncStatus.synced ? localTask : serverTask);
    });
  }

  Future<DateTime?> _getLastSyncTimestamp() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_lastSyncKey);

    if (raw == null || raw.isEmpty) {
      return null;
    }

    final parsed = DateTime.tryParse(raw);
    return parsed;
  }

  Future<void> _saveLastSyncTimestamp(DateTime timestamp) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastSyncKey, timestamp.toIso8601String());
  }
}

class SyncResult {
  final int synced;
  final int failed;
  final int conflicts;

  SyncResult({
    required this.synced,
    required this.failed,
    required this.conflicts,
  });
}
```

```dart
// lib/models/exceptions.dart
import '../models/task.dart';

class ConflictException implements Exception {
  final Task serverVersion;
  ConflictException(this.serverVersion);
}
```

### 6. API Service (Backend Integration)

```dart
// lib/services/api_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/task.dart';
import '../models/exceptions.dart';

class ApiService {
  final String baseUrl;
  final http.Client _client;

  ApiService({
    required this.baseUrl,
    http.Client? client,
  }) : _client = client ?? http.Client();

  Future<Task> createTask(Task task) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/tasks'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'title': task.title,
        'description': task.description,
        'isCompleted': task.isCompleted,
        'createdAt': task.createdAt.toIso8601String(),
      }),
    );

    if (response.statusCode != 201) {
      throw Exception('Failed to create task: ${response.body}');
    }

    final data = jsonDecode(response.body);
    task.remoteId = data['id'];
    return task;
  }

  Future<void> updateTask(Task task, {bool force = false}) async {
    final response = await _client.put(
      Uri.parse('$baseUrl/tasks/${task.remoteId}'),
      headers: {
        'Content-Type': 'application/json',
        if (force) 'X-Force-Update': 'true',
      },
      body: jsonEncode({
        'title': task.title,
        'description': task.description,
        'isCompleted': task.isCompleted,
        'updatedAt': task.updatedAt?.toIso8601String(),
      }),
    );

    if (response.statusCode == 409) {
      final serverData = jsonDecode(response.body);
      throw ConflictException(_taskFromJson(serverData['serverVersion']));
    }

    if (response.statusCode != 200) {
      throw Exception('Failed to update task: ${response.body}');
    }
  }

  Future<void> deleteTask(String remoteId) async {
    final response = await _client.delete(
      Uri.parse('$baseUrl/tasks/$remoteId'),
    );

    if (response.statusCode != 204 && response.statusCode != 404) {
      throw Exception('Failed to delete task: ${response.body}');
    }
  }

  Future<List<Task>> getTasksSince(DateTime? since) async {
    final uri = since != null
        ? Uri.parse('$baseUrl/tasks?since=${since.toIso8601String()}')
        : Uri.parse('$baseUrl/tasks');

    final response = await _client.get(uri);

    if (response.statusCode != 200) {
      throw Exception('Failed to fetch tasks: ${response.body}');
    }

    final List<dynamic> data = jsonDecode(response.body);
    return data.map((json) => _taskFromJson(json)).toList();
  }

  Task _taskFromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final title = json['title'];
    final createdAtRaw = json['createdAt'];

    if (id == null) {
      throw FormatException('Task JSON is missing required "id" field');
    }
    if (title == null) {
      throw FormatException('Task JSON is missing required "title" field');
    }
    if (createdAtRaw == null) {
      throw FormatException('Task JSON is missing required "createdAt" field');
    }

    final createdAt = DateTime.tryParse(createdAtRaw.toString());
    if (createdAt == null) {
      throw FormatException('Task JSON has invalid "createdAt" value: $createdAtRaw');
    }

    final description = json['description']?.toString() ?? '';
    final isCompletedValue = json['isCompleted'];
    final isCompleted = isCompletedValue is bool
        ? isCompletedValue
        : isCompletedValue != null
            ? isCompletedValue.toString().toLowerCase() == 'true'
            : false;

    DateTime? updatedAt;
    final updatedAtRaw = json['updatedAt'];
    if (updatedAtRaw != null) {
      updatedAt = DateTime.tryParse(updatedAtRaw.toString());
    }

    final task = Task()
      ..remoteId = id.toString()
      ..title = title.toString()
      ..description = description
      ..isCompleted = isCompleted
      ..createdAt = createdAt
      ..updatedAt = updatedAt;

    // Only set sync metadata after successfully parsing required fields
    task
      ..syncStatus = SyncStatus.synced
      ..lastSyncedAt = DateTime.now();

    return task;
  }
}
```

### 7. Connectivity-Aware UI

Build a UI that responds to offline/online status:

```dart
// lib/widgets/connectivity_indicator.dart
import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityIndicator extends StatelessWidget {
  final Widget child;

  const ConnectivityIndicator({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<ConnectivityResult>>(
      stream: Connectivity().onConnectivityChanged,
      builder: (context, snapshot) {
        final results = snapshot.data ?? [];
        final isOffline = results.isEmpty ||
            results.every((r) => r == ConnectivityResult.none);

        return Column(
          children: [
            if (isOffline)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8),
                color: Colors.orange,
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.cloud_off, color: Colors.white, size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Offline - Changes will sync when connected',
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ],
                ),
              ),
            Expanded(child: child),
          ],
        );
      },
    );
  }
}
```

### 8. Task List Screen with Real-time Updates

```dart
// lib/screens/task_list_screen.dart
import 'package:flutter/material.dart';
import '../models/task.dart';
import '../repositories/task_repository.dart';
import '../widgets/connectivity_indicator.dart';

class TaskListScreen extends StatefulWidget {
  const TaskListScreen({super.key});

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen> {
  final TaskRepository _repository = TaskRepository();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tasks'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: _syncTasks,
          ),
        ],
      ),
      body: ConnectivityIndicator(
        child: StreamBuilder<List<Task>>(
          stream: _repository.watchAllTasks(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final tasks = snapshot.data ?? [];

            if (tasks.isEmpty) {
              return const Center(
                child: Text('No tasks yet. Tap + to add one.'),
              );
            }

            return ListView.builder(
              itemCount: tasks.length,
              itemBuilder: (context, index) {
                final task = tasks[index];
                return TaskTile(
                  task: task,
                  onToggle: () => _repository.toggleTaskCompletion(task.id),
                  onDelete: () => _repository.deleteTask(task.id),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _addTask,
        child: const Icon(Icons.add),
      ),
    );
  }

  Future<void> _addTask() async {
    final title = await showDialog<String>(
      context: context,
      builder: (context) => const AddTaskDialog(),
    );

    if (title != null && title.isNotEmpty) {
      await _repository.createTask(title: title);
    }
  }

  Future<void> _syncTasks() async {
    // Trigger sync via SyncService
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Syncing...')),
    );
  }
}

class TaskTile extends StatelessWidget {
  final Task task;
  final VoidCallback onToggle;
  final VoidCallback onDelete;

  const TaskTile({
    super.key,
    required this.task,
    required this.onToggle,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(task.id.toString()),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDelete(),
      background: Container(
        color: Colors.red,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      child: ListTile(
        leading: Checkbox(
          value: task.isCompleted,
          onChanged: (_) => onToggle(),
        ),
        title: Text(
          task.title,
          style: TextStyle(
            decoration: task.isCompleted
                ? TextDecoration.lineThrough
                : TextDecoration.none,
          ),
        ),
        subtitle: task.description != null ? Text(task.description!) : null,
        trailing: _buildSyncIndicator(),
      ),
    );
  }

  Widget _buildSyncIndicator() {
    switch (task.syncStatus) {
      case SyncStatus.pending:
        return const Icon(Icons.cloud_upload, color: Colors.orange, size: 16);
      case SyncStatus.conflict:
        return const Icon(Icons.warning, color: Colors.red, size: 16);
      case SyncStatus.deleted:
        return const Icon(Icons.delete_outline, color: Colors.grey, size: 16);
      case SyncStatus.synced:
        return const Icon(Icons.cloud_done, color: Colors.green, size: 16);
    }
  }
}

class AddTaskDialog extends StatefulWidget {
  const AddTaskDialog({super.key});

  @override
  State<AddTaskDialog> createState() => _AddTaskDialogState();
}

class _AddTaskDialogState extends State<AddTaskDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Task'),
      content: TextField(
        controller: _controller,
        autofocus: true,
        decoration: const InputDecoration(
          hintText: 'Task title',
          border: OutlineInputBorder(),
        ),
        onSubmitted: (value) => Navigator.of(context).pop(value),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(_controller.text),
          child: const Text('Add'),
        ),
      ],
    );
  }
}
```

## Official Documentation

- [Isar Documentation](https://isar.dev/) - Official Isar guide
- [isar on pub.dev](https://pub.dev/packages/isar) - Package API reference
- [connectivity_plus](https://pub.dev/packages/connectivity_plus) - Network monitoring
- [Isar GitHub](https://github.com/isar/isar) - Source and examples

## Common Pitfalls

### 1. Forgetting to Run Code Generation

**Problem:** Schema classes not recognized, `TaskSchema` undefined.

**Solution:** Run the build_runner after creating or modifying models:
```bash
dart run build_runner build --delete-conflicting-outputs
```

### 2. Writing Outside Transactions

**Problem:** Database operations fail silently or throw errors.

**Solution:** Always wrap writes in transactions:
```dart
// CORRECT
await isar.writeAsync((isar) {
  isar.tasks.put(task);
});

// WRONG - will throw
isar.tasks.put(task);
```

### 3. Blocking UI Thread with Sync Operations

**Problem:** App freezes during database operations.

**Solution:** Use async methods for heavy operations:
```dart
// CORRECT - runs in background isolate
await isar.writeAsync((isar) {
  isar.tasks.putAll(manyTasks);
});

// WRONG - blocks UI
isar.write((isar) {
  isar.tasks.putAll(manyTasks);
});
```

### 4. Not Handling Sync Conflicts

**Problem:** Data loss or corruption during sync.

**Solution:** Implement proper conflict resolution (last-write-wins, server-wins, or manual resolution) and track sync status in your models.

### 5. Missing Index on Frequently Queried Fields

**Problem:** Slow queries on large datasets.

**Solution:** Add `@Index()` annotation to fields used in filters and sorts:
```dart
@Index()
bool isCompleted = false;

@Index()
late DateTime createdAt;
```

## Alternatives

### Hive

**When to use:** Simpler key-value storage needs without complex queries.

**Trade-offs:**
- Pro: Simpler API, smaller package size
- Con: No query system, less efficient for large datasets

### Drift (formerly Moor)

**When to use:** If you prefer SQL and need relational data modeling.

**Trade-offs:**
- Pro: Full SQL support, powerful migrations
- Con: More complex setup, SQL knowledge required

### Objectbox

**When to use:** High-performance needs with automatic sync capabilities.

**Trade-offs:**
- Pro: Very fast, built-in sync option
- Con: Proprietary sync server, larger package

### sqflite

**When to use:** Direct SQLite access with full SQL control.

**Trade-offs:**
- Pro: Full SQLite features, mature ecosystem
- Con: Manual SQL, no reactive queries out of box

## Related Recipes

- [Flutter Authentication with Supabase](./flutter_auth_supabase.md) - Backend with RLS for syncing
- [Flutter Push Notifications with FCM](./flutter_push_notifications_fcm.md) - Trigger sync on push
