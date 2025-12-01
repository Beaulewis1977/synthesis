---
title: "Flutter Authentication with Supabase"
platform: mobile
framework: flutter
framework_version: "3.24.x"
feature_tags:
  - auth
  - social_auth
usage_tier: recipe
tech_stack:
  - supabase
  - flutter
difficulty: intermediate
last_updated: 2025-11-30
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "supabase_flutter 2.8.0"
---

# Flutter Authentication with Supabase

> **Summary:** Implement secure email/password and social authentication in Flutter using Supabase Auth. This recipe covers user registration, login, session management, and OAuth providers (Google, Apple) with best practices for production apps.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK 3.24.x or later installed
- [ ] A Supabase project created at [supabase.com](https://supabase.com)
- [ ] Your Supabase URL and anon key from Project Settings > API
- [ ] Basic understanding of Flutter state management

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.24.x | UI framework |
| supabase_flutter | ^2.8.0 | Supabase client |
| google_sign_in | ^6.2.0 | Native Google auth (optional) |
| sign_in_with_apple | ^6.1.0 | Native Apple auth (optional) |

## Step-by-Step Implementation

### 1. Project Setup

Add the Supabase Flutter package to your project:

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.8.0
```

```bash
flutter pub get
```

### 2. Initialize Supabase

Initialize Supabase before running your app. Store your credentials securely (use environment variables in production):

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
  );

  runApp(const MyApp());
}

// Global accessor for the Supabase client
final supabase = Supabase.instance.client;
```

### 3. Auth Service Implementation

Create a dedicated service for authentication operations:

```dart
// lib/services/auth_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  final SupabaseClient _client;

  AuthService(this._client);

  // Get current user
  User? get currentUser => _client.auth.currentUser;

  // Get current session
  Session? get currentSession => _client.auth.currentSession;

  // Check if user is authenticated
  bool get isAuthenticated => currentUser != null;

  // Listen to auth state changes
  Stream<AuthState> get onAuthStateChange => _client.auth.onAuthStateChange;

  // Sign up with email and password
  Future<AuthResponse> signUp({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signUp(
      email: email,
      password: password,
    );
  }

  // Sign in with email and password
  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) async {
    return await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  // Sign in with magic link (passwordless)
  Future<void> signInWithOtp({required String email}) async {
    await _client.auth.signInWithOtp(
      email: email,
      emailRedirectTo: 'io.supabase.yourapp://callback',
    );
  }

  // Sign out
  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  // Password reset
  Future<void> resetPassword({required String email}) async {
    await _client.auth.resetPasswordForEmail(
      email,
      redirectTo: 'io.supabase.yourapp://reset-callback',
    );
  }

  // Update password
  Future<UserResponse> updatePassword({required String newPassword}) async {
    return await _client.auth.updateUser(
      UserAttributes(password: newPassword),
    );
  }
}
```

### 4. Auth State Management

Listen to auth state changes to manage navigation and UI state:

```dart
// lib/providers/auth_provider.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthProvider extends ChangeNotifier {
  final SupabaseClient _client;
  User? _user;
  bool _isLoading = true;
  StreamSubscription<AuthState>? _authSubscription;

  AuthProvider(this._client) {
    _initialize();
  }

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  void _initialize() {
    // Get initial session
    _user = _client.auth.currentUser;
    _isLoading = false;
    notifyListeners();

    // Listen to auth changes
    _authSubscription = _client.auth.onAuthStateChange.listen((data) {
      final AuthChangeEvent event = data.event;
      final Session? session = data.session;

      switch (event) {
        case AuthChangeEvent.signedIn:
        case AuthChangeEvent.tokenRefreshed:
          _user = session?.user;
          break;
        case AuthChangeEvent.signedOut:
          _user = null;
          break;
        default:
          break;
      }
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}
```

### 5. Login Screen Widget

```dart
// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      // Navigation handled by auth state listener
    } on AuthException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = 'An unexpected error occurred');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign In')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your email';
                  }
                  if (!value.contains('@')) {
                    return 'Please enter a valid email';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(labelText: 'Password'),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your password';
                  }
                  if (value.length < 6) {
                    return 'Password must be at least 6 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _signIn,
                  child: _isLoading
                      ? const CircularProgressIndicator()
                      : const Text('Sign In'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 6. Native Social Auth (Optional)

For native Google Sign-In (better UX than web-based OAuth):

```dart
// lib/services/social_auth_service.dart
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SocialAuthService {
  final SupabaseClient _client;

  SocialAuthService(this._client);

  // Native Google Sign-In
  Future<AuthResponse> signInWithGoogle() async {
    // Configure with your OAuth client IDs from Google Cloud Console
    const webClientId = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
    const iosClientId = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';

    final GoogleSignIn googleSignIn = GoogleSignIn(
      clientId: iosClientId,
      serverClientId: webClientId,
    );

    final googleUser = await googleSignIn.signIn();
    if (googleUser == null) {
      throw const AuthException('Google sign-in was cancelled');
    }

    final googleAuth = await googleUser.authentication;
    final accessToken = googleAuth.accessToken;
    final idToken = googleAuth.idToken;

    if (accessToken == null || idToken == null) {
      throw const AuthException('Missing Google auth tokens');
    }

    return _client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
      accessToken: accessToken,
    );
  }
}
```

### 7. Deep Link Configuration

For OAuth and magic links, configure deep linking:

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="io.supabase.yourapp" android:host="callback" />
</intent-filter>
```

**iOS** (`ios/Runner/Info.plist`):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>io.supabase.yourapp</string>
    </array>
  </dict>
</array>
```

## Official Documentation

- [Supabase Flutter Auth Guide](https://supabase.com/docs/guides/auth) - Comprehensive auth documentation
- [supabase_flutter on pub.dev](https://pub.dev/packages/supabase_flutter) - Package API reference
- [Supabase Flutter Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/flutter) - Getting started guide

## Common Pitfalls

### 1. Session Not Persisting

**Problem:** User is logged out after app restart.

**Solution:** Supabase Flutter automatically persists sessions. Ensure you're not calling `signOut()` unintentionally and that storage isn't being cleared:

```dart
// Check if session exists on app start
final session = Supabase.instance.client.auth.currentSession;
if (session != null) {
  // User is logged in
}
```

### 2. Email Confirmation Not Working

**Problem:** Users can't confirm their email.

**Solution:** Configure the Site URL and Redirect URLs in Supabase Dashboard > Authentication > URL Configuration. Include your deep link scheme.

### 3. OAuth Redirect Loop

**Problem:** OAuth login opens browser but doesn't return to app.

**Solution:** Ensure your redirect URL matches exactly in:
1. Supabase Dashboard > Authentication > URL Configuration
2. Your app's deep link configuration
3. The `redirectTo` parameter in your code

### 4. Race Condition on Auth State

**Problem:** Navigation happens before auth state is updated.

**Solution:** Use `onAuthStateChange` stream instead of checking session immediately after login:

```dart
supabase.auth.onAuthStateChange.listen((data) {
  if (data.event == AuthChangeEvent.signedIn) {
    // Safe to navigate now
  }
});
```

## Alternatives

### Firebase Authentication

**When to use:** If you're already using Firebase for other services, or need phone authentication with global SMS delivery.

**Trade-offs:**
- Pro: Mature ecosystem, excellent phone auth
- Con: Vendor lock-in, more complex setup for RLS

### Auth0

**When to use:** Enterprise requirements with complex SSO, MFA, or compliance needs.

**Trade-offs:**
- Pro: Enterprise features, extensive identity providers
- Con: Higher cost, separate from database layer

### AppWrite

**When to use:** Self-hosted requirement or preference for open-source alternative.

**Trade-offs:**
- Pro: Self-hosted option, similar features
- Con: Smaller community, less Flutter-specific docs

## Related Recipes

- [Flutter Push Notifications with FCM](./flutter_push_notifications_fcm.md) - Add notifications for auth events
- [Flutter Offline-First with Isar](./flutter_offline_isar.md) - Cache user data locally
