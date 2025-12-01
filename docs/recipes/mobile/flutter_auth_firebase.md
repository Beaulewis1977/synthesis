---
title: "Flutter Authentication with Firebase"
platform: mobile
framework: flutter
framework_version: "3.24.x"
feature_tags:
  - auth
  - social_auth
usage_tier: recipe
tech_stack:
  - firebase
  - flutter
difficulty: intermediate
last_updated: 2025-11-30
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "firebase_auth 5.3.0"
  - "firebase_ui_auth 1.15.0"
---

# Flutter Authentication with Firebase

> **Summary:** Implement secure authentication in Flutter using Firebase Auth with both pre-built UI components (FirebaseUI) and custom implementations. This recipe covers email/password auth, social providers, email verification, and production best practices.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK 3.24.x or later installed
- [ ] A Firebase project created at [console.firebase.google.com](https://console.firebase.google.com)
- [ ] FlutterFire CLI installed (`dart pub global activate flutterfire_cli`)
- [ ] Firebase project configured with `flutterfire configure`
- [ ] Basic understanding of Flutter state management

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.24.x | UI framework |
| firebase_core | ^3.6.0 | Firebase initialization |
| firebase_auth | ^5.3.0 | Authentication API |
| firebase_ui_auth | ^1.15.0 | Pre-built auth UI (optional) |
| google_sign_in | ^6.2.0 | Native Google auth |

## Step-by-Step Implementation

### 1. Project Setup

Add Firebase packages to your project:

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.6.0
  firebase_auth: ^5.3.0
  firebase_ui_auth: ^1.15.0  # Optional: for pre-built UI
  google_sign_in: ^6.2.0     # Optional: for native Google auth
```

```bash
flutter pub get
```

Configure Firebase for your project:

```bash
# Run from project root
flutterfire configure
```

This generates `lib/firebase_options.dart` with your platform-specific configuration.

### 2. Initialize Firebase

Initialize Firebase before running your app:

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  runApp(const MyApp());
}
```

### 3. Option A: Using FirebaseUI (Pre-built Screens)

For rapid development, use the pre-built authentication screens:

```dart
// lib/main.dart
import 'package:firebase_ui_auth/firebase_ui_auth.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Configure auth providers
  FirebaseUIAuth.configureProviders([
    EmailAuthProvider(),
    // GoogleProvider(clientId: 'YOUR_CLIENT_ID'), // Optional
  ]);

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      initialRoute: FirebaseAuth.instance.currentUser == null ? '/login' : '/home',
      routes: {
        '/login': (context) => SignInScreen(
          actions: [
            AuthStateChangeAction<SignedIn>((context, state) {
              if (!state.user!.emailVerified) {
                Navigator.pushNamed(context, '/verify-email');
              } else {
                Navigator.pushReplacementNamed(context, '/home');
              }
            }),
          ],
        ),
        '/verify-email': (context) => EmailVerificationScreen(
          actions: [
            EmailVerifiedAction(() {
              Navigator.pushReplacementNamed(context, '/home');
            }),
            AuthCancelledAction((context) {
              FirebaseUIAuth.signOut(context: context);
              Navigator.pushReplacementNamed(context, '/login');
            }),
          ],
        ),
        '/home': (context) => const HomeScreen(),
        '/profile': (context) => ProfileScreen(
          actions: [
            SignedOutAction((context) {
              Navigator.pushReplacementNamed(context, '/login');
            }),
          ],
        ),
      },
    );
  }
}
```

### 3. Option B: Custom Auth Service

For full control, implement your own auth service:

```dart
// lib/services/auth_service.dart
import 'package:firebase_auth/firebase_auth.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // Get current user
  User? get currentUser => _auth.currentUser;

  // Check if user is authenticated
  bool get isAuthenticated => currentUser != null;

  // Auth state changes stream
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  // Sign up with email and password
  Future<UserCredential> signUp({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      // Send email verification
      await credential.user?.sendEmailVerification();

      return credential;
    } on FirebaseAuthException catch (e) {
      throw _handleAuthException(e);
    }
  }

  // Sign in with email and password
  Future<UserCredential> signIn({
    required String email,
    required String password,
  }) async {
    try {
      return await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
    } on FirebaseAuthException catch (e) {
      throw _handleAuthException(e);
    }
  }

  // Sign out
  Future<void> signOut() async {
    await _auth.signOut();
  }

  // Send password reset email
  Future<void> sendPasswordResetEmail({required String email}) async {
    try {
      await _auth.sendPasswordResetEmail(email: email);
    } on FirebaseAuthException catch (e) {
      throw _handleAuthException(e);
    }
  }

  // Resend email verification
  Future<void> resendEmailVerification() async {
    await currentUser?.sendEmailVerification();
  }

  // Reload user to check email verification status
  Future<void> reloadUser() async {
    await currentUser?.reload();
  }

  // Convert Firebase exceptions to user-friendly messages
  String _handleAuthException(FirebaseAuthException e) {
    switch (e.code) {
      case 'email-already-in-use':
        return 'This email is already registered.';
      case 'invalid-email':
        return 'Please enter a valid email address.';
      case 'operation-not-allowed':
        return 'Email/password accounts are not enabled.';
      case 'weak-password':
        return 'Please enter a stronger password.';
      case 'user-disabled':
        return 'This account has been disabled.';
      case 'user-not-found':
        return 'No account found with this email.';
      case 'wrong-password':
        return 'Incorrect password.';
      case 'invalid-credential':
        return 'Invalid email or password.';
      default:
        return e.message ?? 'An error occurred. Please try again.';
    }
  }
}
```

### 4. Auth State Management

Use a provider or bloc to manage auth state across your app:

```dart
// lib/providers/auth_provider.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AuthProvider extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  User? _user;
  bool _isLoading = true;
  StreamSubscription<User?>? _authSubscription;

  AuthProvider() {
    _initialize();
  }

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;
  bool get isEmailVerified => _user?.emailVerified ?? false;

  void _initialize() {
    _user = _auth.currentUser;
    _isLoading = false;
    notifyListeners();

    _authSubscription = _auth.authStateChanges().listen((User? user) {
      _user = user;
      notifyListeners();
    });
  }

  Future<void> refreshUser() async {
    await _user?.reload();
    _user = _auth.currentUser;
    notifyListeners();
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }
}
```

### 5. Login Screen (Custom Implementation)

```dart
// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _auth = FirebaseAuth.instance;

  bool _isLoading = false;
  bool _isLogin = true;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_isLogin) {
        await _auth.signInWithEmailAndPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
      } else {
        final credential = await _auth.createUserWithEmailAndPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
        await credential.user?.sendEmailVerification();
      }
      // Navigation handled by auth state listener
    } on FirebaseAuthException catch (e) {
      setState(() => _errorMessage = _getErrorMessage(e.code));
    } catch (e) {
      setState(() => _errorMessage = 'An unexpected error occurred');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _getErrorMessage(String code) {
    switch (code) {
      case 'email-already-in-use':
        return 'This email is already registered.';
      case 'invalid-credential':
        return 'Invalid email or password.';
      case 'weak-password':
        return 'Password must be at least 6 characters.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isLogin ? 'Sign In' : 'Sign Up')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade700)),
                ),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Please enter your email';
                  if (!value.contains('@')) return 'Please enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) return 'Please enter your password';
                  if (value.length < 6) return 'Password must be at least 6 characters';
                  return null;
                },
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submit,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(_isLogin ? 'Sign In' : 'Sign Up'),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => setState(() => _isLogin = !_isLogin),
                child: Text(_isLogin
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 6. Google Sign-In (Native)

```dart
// lib/services/google_auth_service.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

class GoogleAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  Future<UserCredential?> signInWithGoogle() async {
    try {
      // Trigger the authentication flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        return null; // User cancelled
      }

      // Obtain the auth details from the request
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      // Create a new credential
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with the Google credential
      return await _auth.signInWithCredential(credential);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> signOut() async {
    await Future.wait([
      _auth.signOut(),
      _googleSignIn.signOut(),
    ]);
  }
}
```

## Official Documentation

- [Firebase Flutter Setup](https://firebase.google.com/docs/flutter/setup) - Initial configuration guide
- [Firebase Auth for Flutter](https://firebase.google.com/docs/auth/flutter/start) - Authentication documentation
- [FirebaseUI for Flutter](https://github.com/firebase/firebaseui-flutter) - Pre-built UI components
- [firebase_auth on pub.dev](https://pub.dev/packages/firebase_auth) - Package API reference

## Common Pitfalls

### 1. SHA-1 Certificate Not Configured (Android)

**Problem:** Google Sign-In fails on Android with "PlatformException".

**Solution:** Add SHA-1 fingerprint to Firebase Console:
```bash
# Get debug SHA-1
cd android && ./gradlew signingReport
```
Add the SHA-1 to Firebase Console > Project Settings > Your apps > Android app.

### 2. Email Verification Check Race Condition

**Problem:** User appears verified immediately after registration.

**Solution:** Always reload the user before checking verification status:
```dart
await FirebaseAuth.instance.currentUser?.reload();
final user = FirebaseAuth.instance.currentUser;
if (user?.emailVerified ?? false) {
  // Now verified
}
```

### 3. Auth State Persists in Debug Mode

**Problem:** User stays logged in between hot restarts during development.

**Solution:** This is expected behavior. For testing logout, call `signOut()` explicitly or use:
```dart
// For testing only - don't use in production
await FirebaseAuth.instance.signOut();
```

### 4. "no-app" Error on iOS

**Problem:** Firebase initialization fails on iOS.

**Solution:** Ensure `GoogleService-Info.plist` is added to Runner target in Xcode, not just the project.

## Alternatives

### Supabase Auth

**When to use:** If you prefer PostgreSQL and open-source, or need Row Level Security tied to auth.

**Trade-offs:**
- Pro: Open-source, integrated RLS, SQL database
- Con: Smaller ecosystem, fewer pre-built UI options

### AWS Amplify Auth (Cognito)

**When to use:** If you're building on AWS infrastructure or need enterprise SSO.

**Trade-offs:**
- Pro: Enterprise features, AWS integration
- Con: Complex setup, vendor lock-in

### Auth0

**When to use:** When you need advanced identity management, compliance, or many identity providers.

**Trade-offs:**
- Pro: Enterprise-grade, extensive features
- Con: Higher cost, external dependency

## Related Recipes

- [Flutter Push Notifications with FCM](./flutter_push_notifications_fcm.md) - Add Firebase Cloud Messaging
- [Flutter Offline-First with Isar](./flutter_offline_isar.md) - Cache user data locally
