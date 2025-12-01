---
title: "Flutter In-App Subscriptions with RevenueCat"
platform: mobile
framework: flutter
framework_version: "3.24.x"
feature_tags:
  - subscriptions
  - billing
  - payments
usage_tier: recipe
tech_stack:
  - revenuecat
  - flutter
difficulty: intermediate
last_updated: 2025-11-30
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "purchases_flutter 8.0.0"
  - "purchases_ui_flutter 8.0.0"
---

# Flutter In-App Subscriptions with RevenueCat

> **Summary:** Implement cross-platform in-app subscriptions in Flutter using RevenueCat. This recipe covers subscription setup, entitlement checking, paywall display, and subscription management with support for both App Store and Google Play.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK 3.24.x or later installed
- [ ] A RevenueCat account at [app.revenuecat.com](https://app.revenuecat.com)
- [ ] App Store Connect account with in-app purchase products configured (iOS)
- [ ] Google Play Console with subscription products configured (Android)
- [ ] RevenueCat API keys for iOS and Android
- [ ] Basic understanding of async Dart

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.24.x | UI framework |
| purchases_flutter | ^8.0.0 | RevenueCat core SDK |
| purchases_ui_flutter | ^8.0.0 | Pre-built paywall UI (optional) |

## Step-by-Step Implementation

### 1. Project Setup

Add RevenueCat packages to your project:

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  purchases_flutter: ^8.0.0
  purchases_ui_flutter: ^8.0.0  # Optional: for pre-built paywalls
```

```bash
flutter pub get
```

### 2. Platform Configuration

**iOS** (`ios/Runner/Info.plist`):
```xml
<!-- Required for StoreKit -->
<key>SKAdNetworkItems</key>
<array>
    <dict>
        <key>SKAdNetworkIdentifier</key>
        <string>cstr6suwn9.skadnetwork</string>
    </dict>
</array>
```

**Android** - No additional configuration needed for basic setup.

### 3. Initialize RevenueCat

Initialize RevenueCat early in your app, before any UI is shown:

```dart
// lib/main.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await _initRevenueCat();

  runApp(const MyApp());
}

Future<void> _initRevenueCat() async {
  // Enable debug logs during development
  await Purchases.setLogLevel(LogLevel.debug);

  // Use platform-specific API keys
  late PurchasesConfiguration configuration;

  if (Platform.isIOS) {
    configuration = PurchasesConfiguration('appl_your_ios_api_key');
  } else if (Platform.isAndroid) {
    configuration = PurchasesConfiguration('goog_your_android_api_key');
  }

  // Optional: Set user ID for logged-in users
  // configuration.appUserID = 'user_12345';

  await Purchases.configure(configuration);
}
```

### 4. Subscription Service

Create a service to manage subscriptions:

```dart
// lib/services/subscription_service.dart
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

class SubscriptionService {
  static const String _premiumEntitlement = 'premium';

  /// Check if user has active premium subscription
  Future<bool> isPremium() async {
    try {
      final customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active.containsKey(_premiumEntitlement);
    } catch (e) {
      return false;
    }
  }

  /// Get current customer info with all entitlements
  Future<CustomerInfo> getCustomerInfo() async {
    return await Purchases.getCustomerInfo();
  }

  /// Get available offerings (subscription products)
  Future<Offerings?> getOfferings() async {
    try {
      final offerings = await Purchases.getOfferings();
      return offerings;
    } catch (e) {
      return null;
    }
  }

  /// Purchase a package
  Future<PurchaseResult> purchasePackage(Package package) async {
    try {
      final params = PurchaseParams.package(package);
      final purchaseResult = await Purchases.purchase(params);
      return PurchaseResult.success(purchaseResult.customerInfo);
    } on PlatformException catch (e) {
      final errorCode = PurchasesErrorHelper.getErrorCode(e);

      if (errorCode == PurchasesErrorCode.purchaseCancelledError) {
        return PurchaseResult.cancelled();
      }

      return PurchaseResult.error(e.message ?? 'Purchase failed');
    }
  }

  /// Restore previous purchases
  Future<CustomerInfo> restorePurchases() async {
    return await Purchases.restorePurchases();
  }

  /// Login user (associates purchases with user ID)
  Future<CustomerInfo> login(String userId) async {
    final result = await Purchases.logIn(userId);
    return result.customerInfo;
  }

  /// Logout user (creates anonymous user)
  Future<CustomerInfo> logout() async {
    return await Purchases.logOut();
  }

  /// Listen for subscription changes
  void addCustomerInfoListener(void Function(CustomerInfo) listener) {
    Purchases.addCustomerInfoUpdateListener(listener);
  }
}

/// Result class for purchase operations
class PurchaseResult {
  final bool success;
  final bool cancelled;
  final CustomerInfo? customerInfo;
  final String? error;

  PurchaseResult._({
    required this.success,
    required this.cancelled,
    this.customerInfo,
    this.error,
  });

  factory PurchaseResult.success(CustomerInfo info) =>
      PurchaseResult._(success: true, cancelled: false, customerInfo: info);

  factory PurchaseResult.cancelled() =>
      PurchaseResult._(success: false, cancelled: true);

  factory PurchaseResult.error(String message) =>
      PurchaseResult._(success: false, cancelled: false, error: message);
}
```

### 5. Subscription State Management

Use a provider to manage subscription state across the app:

```dart
// lib/providers/subscription_provider.dart
import 'package:flutter/material.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../services/subscription_service.dart';

class SubscriptionProvider extends ChangeNotifier {
  final SubscriptionService _service = SubscriptionService();

  bool _isPremium = false;
  bool _isLoading = true;
  Offerings? _offerings;
  CustomerInfo? _customerInfo;

  bool get isPremium => _isPremium;
  bool get isLoading => _isLoading;
  Offerings? get offerings => _offerings;
  CustomerInfo? get customerInfo => _customerInfo;

  /// Get current offering (default offering configured in RevenueCat)
  Offering? get currentOffering => _offerings?.current;

  SubscriptionProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    // Fetch initial data
    await Future.wait([
      _refreshCustomerInfo(),
      _fetchOfferings(),
    ]);

    _isLoading = false;
    notifyListeners();

    // Listen for changes
    _service.addCustomerInfoListener(_onCustomerInfoUpdated);
  }

  void _onCustomerInfoUpdated(CustomerInfo info) {
    _customerInfo = info;
    _isPremium = info.entitlements.active.containsKey('premium');
    notifyListeners();
  }

  Future<void> _refreshCustomerInfo() async {
    try {
      _customerInfo = await _service.getCustomerInfo();
    } catch (e) {
      _customerInfo = null;
    }

    _isPremium =
        _customerInfo?.entitlements.active.containsKey('premium') ?? false;
  }

  Future<void> _fetchOfferings() async {
    _offerings = await _service.getOfferings();
  }

  Future<PurchaseResult> purchase(Package package) async {
    final result = await _service.purchasePackage(package);
    if (result.success) {
      _customerInfo = result.customerInfo;
      _isPremium = true;
      notifyListeners();
    }
    return result;
  }

  Future<void> restorePurchases() async {
    try {
      _customerInfo = await _service.restorePurchases();
      _isPremium =
          _customerInfo?.entitlements.active.containsKey('premium') ?? false;
    } catch (e) {
      _customerInfo = null;
      _isPremium = false;
    } finally {
      notifyListeners();
    }
  }
}
```

### 6. Custom Paywall Screen

Build a custom paywall to display subscription options:

```dart
// lib/screens/paywall_screen.dart
import 'package:flutter/material.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:provider/provider.dart';
import '../providers/subscription_provider.dart';

class PaywallScreen extends StatelessWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SubscriptionProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final offering = provider.currentOffering;
        if (offering == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Upgrade')),
            body: const Center(
              child: Text('No products available'),
            ),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: const Text('Upgrade to Premium'),
            leading: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: Column(
            children: [
              // Benefits section
              const Padding(
                padding: EdgeInsets.all(24),
                child: Column(
                  children: [
                    Icon(Icons.star, size: 64, color: Colors.amber),
                    SizedBox(height: 16),
                    Text(
                      'Unlock Premium Features',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 24),
                    _BenefitRow(icon: Icons.check, text: 'Unlimited access'),
                    _BenefitRow(icon: Icons.check, text: 'No ads'),
                    _BenefitRow(icon: Icons.check, text: 'Priority support'),
                    _BenefitRow(icon: Icons.check, text: 'Exclusive content'),
                  ],
                ),
              ),
              const Spacer(),
              // Package options
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: offering.availablePackages.map((package) {
                    return _PackageCard(package: package);
                  }).toList(),
                ),
              ),
              // Restore button
              TextButton(
                onPressed: () async {
                  await provider.restorePurchases();
                  if (context.mounted && provider.isPremium) {
                    Navigator.pop(context, true);
                  }
                },
                child: const Text('Restore Purchases'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }
}

class _BenefitRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _BenefitRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: Colors.green),
          const SizedBox(width: 12),
          Text(text, style: const TextStyle(fontSize: 16)),
        ],
      ),
    );
  }
}

class _PackageCard extends StatefulWidget {
  final Package package;

  const _PackageCard({required this.package});

  @override
  State<_PackageCard> createState() => _PackageCardState();
}

class _PackageCardState extends State<_PackageCard> {
  bool _isLoading = false;

  String _getPackageTitle() {
    switch (widget.package.packageType) {
      case PackageType.monthly:
        return 'Monthly';
      case PackageType.annual:
        return 'Annual';
      case PackageType.weekly:
        return 'Weekly';
      case PackageType.lifetime:
        return 'Lifetime';
      default:
        return widget.package.storeProduct.title;
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.package.storeProduct;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: _isLoading ? null : _purchase,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getPackageTitle(),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (product.introductoryPrice != null)
                      Text(
                        'Free trial: ${product.introductoryPrice!.periodNumberOfUnits} ${product.introductoryPrice!.periodUnit.name}',
                        style: TextStyle(
                          color: Colors.green.shade700,
                          fontSize: 14,
                        ),
                      ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    product.priceString,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    _getPeriodText(),
                    style: const TextStyle(
                      color: Colors.grey,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.only(left: 16),
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _getPeriodText() {
    switch (widget.package.packageType) {
      case PackageType.monthly:
        return '/month';
      case PackageType.annual:
        return '/year';
      case PackageType.weekly:
        return '/week';
      case PackageType.lifetime:
        return 'one-time';
      default:
        return '';
    }
  }

  Future<void> _purchase() async {
    setState(() => _isLoading = true);

    final provider = context.read<SubscriptionProvider>();
    final result = await provider.purchase(widget.package);

    if (mounted) {
      setState(() => _isLoading = false);

      if (result.success) {
        Navigator.pop(context, true);
      } else if (result.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.error!)),
        );
      }
    }
  }
}
```

### 7. Using Pre-built Paywalls (Optional)

RevenueCat offers pre-built paywalls that can be configured in their dashboard:

```dart
// lib/screens/home_screen.dart
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart';
import 'package:provider/provider.dart';
import '../providers/subscription_provider.dart';

class HomeScreen extends StatelessWidget {
  Future<void> _showPaywall(BuildContext context) async {
    final provider = context.read<SubscriptionProvider>();

    // Option 1: Always show paywall
    final result = await RevenueCatUI.presentPaywall(
      offering: provider.currentOffering,
      displayCloseButton: true,
    );

    if (result == PaywallResult.purchased) {
      // Handle successful purchase
    }

    // Option 2: Only show if user doesn't have entitlement
    await RevenueCatUI.presentPaywallIfNeeded(
      'premium',
      offering: provider.currentOffering,
    );
  }

  Future<void> _showCustomerCenter(BuildContext context) async {
    // Show subscription management screen
    await RevenueCatUI.presentCustomerCenter();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SubscriptionProvider>(
      builder: (context, provider, _) {
        return Scaffold(
          appBar: AppBar(title: const Text('Home')),
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  provider.isPremium ? 'Premium User' : 'Free User',
                  style: const TextStyle(fontSize: 24),
                ),
                const SizedBox(height: 24),
                if (!provider.isPremium)
                  ElevatedButton(
                    onPressed: () => _showPaywall(context),
                    child: const Text('Upgrade to Premium'),
                  ),
                if (provider.isPremium)
                  TextButton(
                    onPressed: () => _showCustomerCenter(context),
                    child: const Text('Manage Subscription'),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
```

### 8. Testing

**Sandbox Testing:**
- iOS: Use a Sandbox tester account (App Store Connect > Users > Sandbox Testers)
- Android: Add tester email to internal testing track or license testers

**Test Scenarios:**
1. New subscription purchase
2. Restore purchases on new device
3. Subscription cancellation and renewal
4. Free trial to paid conversion
5. Upgrade/downgrade between plans

## Official Documentation

- [RevenueCat Flutter SDK](https://www.revenuecat.com/docs/flutter) - Official documentation
- [purchases_flutter on pub.dev](https://pub.dev/packages/purchases_flutter) - Package reference
- [RevenueCat Dashboard](https://app.revenuecat.com) - Configure products and entitlements
- [Testing Subscriptions](https://www.revenuecat.com/docs/test-purchases) - Testing guide

## Common Pitfalls

### 1. Products Not Loading

**Problem:** `getOfferings()` returns null or empty.

**Solution:**
1. Verify products are configured in App Store Connect / Google Play Console
2. Ensure products are linked in RevenueCat Dashboard > Products
3. Create an Offering in RevenueCat Dashboard > Offerings
4. Check that API key matches the platform

### 2. "Purchases are not allowed on this device"

**Problem:** Error when attempting purchase on simulator.

**Solution:** Test on a physical device. iOS Simulator doesn't support StoreKit purchases. Use Xcode's StoreKit Configuration file for local testing.

### 3. User ID Conflicts

**Problem:** Purchases not showing for logged-in users.

**Solution:** Call `Purchases.logIn(userId)` when user logs in, and `Purchases.logOut()` when they log out:
```dart
// When user logs in to your app
await Purchases.logIn(yourAppUserId);

// When user logs out
await Purchases.logOut();
```

### 4. Entitlements Not Updating

**Problem:** User purchased but `isPremium` is still false.

**Solution:** Use the customer info listener for real-time updates:
```dart
Purchases.addCustomerInfoUpdateListener((customerInfo) {
  // This is called whenever entitlements change
  updatePremiumStatus(customerInfo);
});
```

## Alternatives

### Stripe (Direct IAP)

**When to use:** If you want to use Stripe for web payments and manage your own receipt validation.

**Trade-offs:**
- Pro: Unified payment system across web and mobile
- Con: Must handle receipt validation and subscription logic yourself

### Qonversion

**When to use:** If you need more advanced analytics or A/B testing for subscription pricing.

**Trade-offs:**
- Pro: Advanced analytics, similar cross-platform support
- Con: Smaller community, fewer integrations

### Direct StoreKit/Play Billing

**When to use:** If you want complete control and have engineering resources for receipt validation.

**Trade-offs:**
- Pro: No third-party dependency, no revenue share
- Con: Complex implementation, must build backend for receipt validation

## Related Recipes

- [Flutter Payments with Stripe](./flutter_stripe_payments.md) - One-time payments
- [Flutter Authentication with Supabase](./flutter_auth_supabase.md) - User management for subscriptions
