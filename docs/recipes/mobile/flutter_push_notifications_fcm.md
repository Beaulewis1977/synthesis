---
title: "Flutter Push Notifications with Firebase Cloud Messaging"
platform: mobile
framework: flutter
framework_version: "3.24.x"
feature_tags:
  - push_notifications
  - realtime
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
  - "firebase_messaging 15.1.0"
  - "flutter_local_notifications 17.2.0"
---

# Flutter Push Notifications with Firebase Cloud Messaging

> **Summary:** Implement push notifications in Flutter using Firebase Cloud Messaging (FCM). This recipe covers receiving notifications in foreground/background/terminated states, handling notification taps, topic subscriptions, and displaying rich notifications with images.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK 3.24.x or later installed
- [ ] A Firebase project created and configured with FlutterFire CLI
- [ ] iOS: APNs key uploaded to Firebase Console
- [ ] Android: google-services.json in place
- [ ] Basic understanding of Firebase and async Dart

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.24.x | UI framework |
| firebase_core | ^3.6.0 | Firebase initialization |
| firebase_messaging | ^15.1.0 | FCM client |
| flutter_local_notifications | ^17.2.0 | Local notification display |
| http | ^1.2.0 | Image download for rich notifications |
| path_provider | ^2.1.0 | Temporary file storage |

## Step-by-Step Implementation

### 1. Project Setup

Add Firebase Messaging packages:

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.6.0
  firebase_messaging: ^15.1.0
  flutter_local_notifications: ^17.2.0
  http: ^1.2.0              # For downloading notification images
  path_provider: ^2.1.0     # For temporary file storage
```

```bash
flutter pub get
```

### 2. Platform Configuration

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<manifest>
    <!-- Add notification permission for Android 13+ -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

    <application>
        <!-- FCM default channel (optional) -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="high_importance_channel" />

        <!-- FCM default icon (optional) -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@mipmap/ic_notification" />

        <!-- FCM default color (optional) -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/notification_color" />
    </application>
</manifest>
```

**iOS** - Enable Push Notifications capability in Xcode:
1. Open `ios/Runner.xcworkspace` in Xcode
2. Select Runner target > Signing & Capabilities
3. Click "+ Capability" and add "Push Notifications"
4. Add "Background Modes" and enable "Remote notifications"

**iOS** (`ios/Runner/AppDelegate.swift`) - For foreground notifications:
```swift
import UIKit
import Flutter
import FirebaseCore
import FirebaseMessaging

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    FirebaseApp.configure()

    // Request notification authorization
    UNUserNotificationCenter.current().delegate = self

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

### 3. Initialize Firebase Messaging

Create a top-level background handler and initialize messaging:

```dart
// lib/main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';
import 'services/notification_service.dart';

// Must be a top-level function (not a class method)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  print('Background message: ${message.messageId}');
  // Handle the background message
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Set the background handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Initialize notification service
  await NotificationService.instance.initialize();

  runApp(const MyApp());
}
```

### 4. Notification Service

Create a comprehensive notification service:

```dart
// lib/services/notification_service.dart
import 'dart:convert';
import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  // Notification channel for Android
  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'high_importance_channel',
    'High Importance Notifications',
    description: 'This channel is used for important notifications.',
    importance: Importance.high,
  );

  // Callback for notification tap
  void Function(Map<String, dynamic>)? onNotificationTap;

  Future<void> initialize() async {
    // Request permission
    await _requestPermission();

    // Initialize local notifications
    await _initializeLocalNotifications();

    // Create Android notification channel
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    // Get and save FCM token
    await _getToken();

    // Listen to token refresh
    _messaging.onTokenRefresh.listen(_onTokenRefresh);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle notification tap when app in background
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

    // Handle notification tap when app was terminated
    await _handleInitialMessage();
  }

  Future<void> _requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
    );

    print('Permission status: ${settings.authorizationStatus}');
  }

  Future<void> _initializeLocalNotifications() async {
    const initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const initializationSettingsIOS = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await _localNotifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: _onNotificationResponse,
    );
  }

  void _onNotificationResponse(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null && onNotificationTap != null) {
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        onNotificationTap!(data);
      } catch (e) {
        print('Error parsing notification payload: $e');
      }
    }
  }

  Future<String?> _getToken() async {
    final token = await _messaging.getToken();
    print('FCM Token: $token');
    // TODO: Send token to your server
    return token;
  }

  void _onTokenRefresh(String token) {
    print('FCM Token refreshed: $token');
    // TODO: Update token on your server
  }

  void _handleForegroundMessage(RemoteMessage message) {
    print('Foreground message received: ${message.messageId}');

    final notification = message.notification;
    if (notification != null) {
      // Show local notification
      _showLocalNotification(
        id: message.hashCode,
        title: notification.title ?? '',
        body: notification.body ?? '',
        payload: jsonEncode(message.data),
        imageUrl: notification.android?.imageUrl ?? notification.apple?.imageUrl,
      );
    }
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    print('Message opened app: ${message.messageId}');
    if (onNotificationTap != null) {
      onNotificationTap!(message.data);
    }
  }

  Future<void> _handleInitialMessage() async {
    final message = await _messaging.getInitialMessage();
    if (message != null) {
      print('App opened from terminated state: ${message.messageId}');
      // Delay to ensure app is ready
      await Future.delayed(const Duration(seconds: 1));
      if (onNotificationTap != null) {
        onNotificationTap!(message.data);
      }
    }
  }

  Future<void> _showLocalNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
    String? imageUrl,
  }) async {
    AndroidNotificationDetails androidDetails;

    if (imageUrl != null) {
      // Rich notification with image
      final bigPicture = await _downloadAndSaveImage(imageUrl);
      androidDetails = AndroidNotificationDetails(
        _channel.id,
        _channel.name,
        channelDescription: _channel.description,
        importance: Importance.high,
        priority: Priority.high,
        styleInformation: bigPicture != null
            ? BigPictureStyleInformation(
                FilePathAndroidBitmap(bigPicture),
                contentTitle: title,
                summaryText: body,
              )
            : null,
      );
    } else {
      androidDetails = AndroidNotificationDetails(
        _channel.id,
        _channel.name,
        channelDescription: _channel.description,
        importance: Importance.high,
        priority: Priority.high,
      );
    }

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _localNotifications.show(
      id,
      title,
      body,
      NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: payload,
    );
  }

  Future<String?> _downloadAndSaveImage(String url) async {
    try {
      // Download image from URL
      final response = await http.get(Uri.parse(url));
      if (response.statusCode != 200) return null;

      // Get temporary directory for storing the image
      final directory = await getTemporaryDirectory();
      
      // Derive filename from URL or use a timestamp
      final uri = Uri.parse(url);
      final filename = uri.pathSegments.isNotEmpty 
          ? uri.pathSegments.last 
          : 'notification_${DateTime.now().millisecondsSinceEpoch}.jpg';
      
      // Write file to temporary storage
      final filePath = '${directory.path}/$filename';
      final file = File(filePath);
      await file.writeAsBytes(response.bodyBytes);
      
      return filePath;
    } catch (e) {
      print('Failed to download notification image: $e');
      return null;
    }
  }

  // Public methods

  /// Subscribe to a topic
  Future<void> subscribeToTopic(String topic) async {
    await _messaging.subscribeToTopic(topic);
    print('Subscribed to topic: $topic');
  }

  /// Unsubscribe from a topic
  Future<void> unsubscribeFromTopic(String topic) async {
    await _messaging.unsubscribeFromTopic(topic);
    print('Unsubscribed from topic: $topic');
  }

  /// Get current FCM token
  Future<String?> getToken() async {
    return await _messaging.getToken();
  }
}
```

### 5. Handle Notification Taps

Set up navigation based on notification data:

```dart
// lib/app.dart
import 'package:flutter/material.dart';
import 'services/notification_service.dart';

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    _setupNotificationHandler();
  }

  void _setupNotificationHandler() {
    NotificationService.instance.onNotificationTap = (data) {
      _handleNotificationNavigation(data);
    };
  }

  void _handleNotificationNavigation(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    final id = data['id'] as String?;

    switch (type) {
      case 'chat':
        _navigatorKey.currentState?.pushNamed('/chat', arguments: id);
        break;
      case 'order':
        _navigatorKey.currentState?.pushNamed('/order', arguments: id);
        break;
      case 'promo':
        _navigatorKey.currentState?.pushNamed('/promo', arguments: id);
        break;
      default:
        // Navigate to default screen
        _navigatorKey.currentState?.pushNamed('/notifications');
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      title: 'My App',
      initialRoute: '/',
      routes: {
        '/': (context) => const HomeScreen(),
        '/chat': (context) => const ChatScreen(),
        '/order': (context) => const OrderScreen(),
        '/notifications': (context) => const NotificationsScreen(),
        // ... other routes
      },
    );
  }
}
```

### 6. Send Notifications from Server

Example payload for FCM HTTP v1 API:

```json
{
  "message": {
    "token": "FCM_TOKEN_HERE",
    "notification": {
      "title": "New Message",
      "body": "You have a new message from John"
    },
    "data": {
      "type": "chat",
      "id": "chat_123",
      "senderId": "user_456"
    },
    "android": {
      "notification": {
        "click_action": "FLUTTER_NOTIFICATION_CLICK",
        "channel_id": "high_importance_channel"
      }
    },
    "apns": {
      "payload": {
        "aps": {
          "sound": "default",
          "badge": 1
        }
      }
    }
  }
}
```

### 7. Testing

**Test on Android:**
1. Run the app on a physical device or emulator
2. Note the FCM token from logs
3. Use Firebase Console > Cloud Messaging > Send test message
4. Test in foreground, background, and terminated states

**Test on iOS:**
1. Run on physical device (simulator doesn't support push)
2. Ensure APNs key is configured in Firebase Console
3. Test different notification states

## Official Documentation

- [Firebase Cloud Messaging Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/client) - Official FCM guide
- [firebase_messaging on pub.dev](https://pub.dev/packages/firebase_messaging) - Package reference
- [flutter_local_notifications on pub.dev](https://pub.dev/packages/flutter_local_notifications) - Local notifications
- [FCM HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/send-message) - Server-side sending

## Common Pitfalls

### 1. Notifications Not Received on iOS

**Problem:** Push notifications work on Android but not iOS.

**Solution:**
1. Verify APNs key is uploaded to Firebase Console
2. Check that Push Notifications capability is enabled in Xcode
3. Ensure you're testing on a physical device
4. Check APNs environment (development vs production)

### 2. Background Handler Not Called

**Problem:** `onBackgroundMessage` handler never executes.

**Solution:** Ensure the handler is a **top-level function** (not a method):
```dart
// CORRECT - Top-level function
@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async { ... }

// WRONG - Class method
class MyClass {
  Future<void> _backgroundHandler(RemoteMessage message) async { ... }
}
```

### 3. Foreground Notifications Not Showing

**Problem:** Notifications arrive but don't display when app is in foreground.

**Solution:** FCM doesn't display notifications in foreground by default. Use `flutter_local_notifications` to show them:
```dart
FirebaseMessaging.onMessage.listen((message) {
  // Show local notification manually
  _showLocalNotification(message);
});
```

### 4. Token is Null

**Problem:** `getToken()` returns null.

**Solution:**
1. Ensure Firebase is initialized before calling
2. On iOS, request permission first (token requires permission)
3. Check internet connectivity
4. Verify Firebase configuration is correct

## Alternatives

### OneSignal

**When to use:** If you need a simpler setup with a dashboard for sending notifications without writing backend code.

**Trade-offs:**
- Pro: Easy setup, built-in dashboard, free tier
- Con: Less control, third-party dependency

### Pusher Beams

**When to use:** If you're already using Pusher for real-time features.

**Trade-offs:**
- Pro: Unified real-time + push solution
- Con: Smaller community, paid service

### AWS SNS + Pinpoint

**When to use:** If you're building on AWS infrastructure.

**Trade-offs:**
- Pro: AWS integration, scalable
- Con: More complex setup, AWS lock-in

## Related Recipes

- [Flutter Authentication with Firebase](./flutter_auth_firebase.md) - User management for targeted notifications
- [Flutter Authentication with Supabase](./flutter_auth_supabase.md) - Alternative authentication for user identification
