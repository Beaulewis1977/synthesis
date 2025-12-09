---
title: "Flutter State Management with Riverpod"
platform: mobile
framework: flutter
feature_tags:
  - state_management
  - architecture
usage_tier: recipe
framework_version: "3.24.x"
tech_stack:
  - flutter_riverpod
  - riverpod_annotation
  - freezed
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "flutter_riverpod 2.5.1"
  - "riverpod_annotation 2.3.5"
---

# Flutter State Management with Riverpod

> **Summary:** Implement robust, scalable state management using Riverpod with code generation. This recipe covers the Notifier pattern, AsyncValue for data fetching, and immutable state with Freezed.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK 3.24.x installed
- [ ] `build_runner` set up for code generation
- [ ] Basic understanding of Dependency Injection

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| flutter_riverpod | ^2.5.1 | Core state management |
| riverpod_annotation | ^2.3.5 | Code generation annotations |
| riverpod_generator | ^2.4.0 | Builder for providers |
| freezed_annotation | ^2.4.1 | Immutable data classes |

## Step-by-Step Implementation

### 1. Project Setup

Add dependencies for Riverpod and Code Gen:

```bash
flutter pub add flutter_riverpod riverpod_annotation freezed_annotation
flutter pub add --dev build_runner riverpod_generator freezed
```

Wrap your app with `ProviderScope`:

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}
```

### 2. Defining Dependencies (Providers)

Use `@riverpod` to create simple providers for dependencies (like Supabase client or Repositories).

```dart
// lib/providers/dependencies.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

part 'dependencies.g.dart';

@Riverpod(keepAlive: true)
SupabaseClient supabase(SupabaseRef ref) {
  return Supabase.instance.client;
}
```

### 3. Async State (AsyncNotifier)

Handle data fetching with `AsyncNotifier` and `AsyncValue`.

```dart
// lib/features/todos/providers/todo_list_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import '../../providers/dependencies.dart';

part 'todo_list_provider.g.dart';
part 'todo_list_provider.freezed.dart';

@freezed
class Todo with _$Todo {
  factory Todo({
    required String id,
    required String title,
    @Default(false) bool completed,
  }) = _Todo;
  
  factory Todo.fromJson(Map<String, dynamic> json) => _$TodoFromJson(json);
}

@riverpod
class TodoList extends _$TodoList {
  @override
  FutureOr<List<Todo>> build() async {
    // Access other providers using `ref`
    final client = ref.watch(supabaseProvider);
    final data = await client.from('todos').select();
    return data.map((e) => Todo.fromJson(e)).toList();
  }

  Future<void> addTodo(String title) async {
    // Set state to loading
    state = const AsyncValue.loading();
    
    // Perform operation
    state = await AsyncValue.guard(() async {
      final client = ref.read(supabaseProvider);
      final newItem = await client
          .from('todos')
          .insert({'title': title})
          .select()
          .single();
          
      // Refresh list
      return [
        ...?state.value,
        Todo.fromJson(newItem),
      ];
    });
  }
}
```

### 4. Consuming State in UI

Use `ConsumerWidget` and `ref.watch` to rebuild widgets when state changes.

```dart
// lib/features/todos/screens/todo_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/todo_list_provider.dart';

class TodoScreen extends ConsumerWidget {
  const TodoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the provider
    final todoListAsync = ref.watch(todoListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Todos')),
      body: todoListAsync.when(
        data: (todos) => ListView.builder(
          itemCount: todos.length,
          itemBuilder: (context, index) {
            final todo = todos[index];
            return ListTile(
              title: Text(todo.title),
              leading: Checkbox(
                value: todo.completed,
                onChanged: (_) {
                  // TODO: Implement toggle logic
                  // ref.read(todoListProvider.notifier).toggle(todo.id);
                },
              ),
            );
          },
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          ref.read(todoListProvider.notifier).addTodo('New Item');
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
```

## Common Pitfalls

### 1. Reading Providers Incorrectly

**Problem:** Using `ref.read` inside `build()` method causes the widget not to update when state changes.

**Solution:** Always use `ref.watch` inside `build()`. Use `ref.read` only inside callbacks (like buttons `onPressed`).

### 2. Mutable State

**Problem:** Modifying list objects directly doesn't trigger updates.

**Solution:** Always use immutable state (Freezed) and replace the object.

```dart
// Bad
state.value?.add(newItem);
// Good
state = AsyncValue.data([...state.value ?? [], newItem]);
```

## Related Recipes

- [Navigation with GoRouter](./flutter_navigation_gorouter.md) - Use Riverpod for auth guards
- [Networking with Retrofit](./flutter_networking_retrofit.md) - Inject API clients
