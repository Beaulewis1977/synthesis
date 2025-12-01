---
title: "Flutter Payments with Stripe"
platform: mobile
framework: flutter
framework_version: "3.24.x"
feature_tags:
  - payments
  - billing
usage_tier: recipe
tech_stack:
  - stripe
  - flutter
difficulty: intermediate
last_updated: 2025-11-30
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "flutter_stripe 11.2.0"
---

# Flutter Payments with Stripe

> **Summary:** Implement secure payment processing in Flutter using Stripe's Payment Sheet. This recipe covers one-time payments, saved payment methods, Apple Pay, Google Pay, and backend integration with best practices for production apps.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK 3.24.x or later installed
- [ ] A Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
- [ ] Your Stripe publishable and secret keys
- [ ] A backend server (Node.js, Python, etc.) for creating PaymentIntents
- [ ] Basic understanding of async Dart and HTTP requests

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Flutter | 3.24.x | UI framework |
| flutter_stripe | ^11.2.0 | Stripe SDK for Flutter |
| http | ^1.2.0 | HTTP client for API calls |

## Step-by-Step Implementation

### 1. Project Setup

Add the Stripe Flutter package:

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_stripe: ^11.2.0
  http: ^1.2.0
```

```bash
flutter pub get
```

### 2. Platform Configuration

**Android** (`android/app/build.gradle`):
```gradle
android {
    compileSdkVersion 35  // Android 15 (required by Google Play as of Aug 2025)

    defaultConfig {
        minSdkVersion 21  // Minimum for Stripe
        // ...
    }
}
```

**Android** (`android/app/src/main/AndroidManifest.xml`) - Add for Google Pay:
```xml
<application>
    <!-- Add inside <application> tag -->
    <meta-data
        android:name="com.google.android.gms.wallet.api.enabled"
        android:value="true" />
</application>
```

**iOS** (`ios/Runner/Info.plist`) - Add for Apple Pay:
```xml
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
</array>
```

### 3. Initialize Stripe

Initialize Stripe early in your app lifecycle:

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Stripe with your publishable key
  Stripe.publishableKey = const String.fromEnvironment(
    'STRIPE_PUBLISHABLE_KEY',
    defaultValue: 'pk_test_...',  // Use test key for development
  );

  // Optional: Set merchant identifier for Apple Pay
  Stripe.merchantIdentifier = 'merchant.com.yourapp';

  // Optional: Enable Apple Pay in a specific country
  await Stripe.instance.applySettings();

  runApp(const MyApp());
}
```

### 4. Backend Setup (Node.js Example)

Your server must create PaymentIntents and manage customer data:

```javascript
// server.js (Node.js with Express)
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(express.json());

// Create a PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, customerId } = req.body;

    // Create or retrieve customer
    let customer;
    if (customerId) {
      customer = await stripe.customers.retrieve(customerId);
    } else {
      customer = await stripe.customers.create();
    }

    // Create ephemeral key for the customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2024-06-20' }
    );

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,  // Amount in cents
      currency: currency || 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### 5. Payment Service Implementation

Create a service to handle payment operations:

```dart
// lib/services/payment_service.dart
import 'dart:convert';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:http/http.dart' as http;

class PaymentService {
  static const String _baseUrl = 'https://your-api.com';  // Your backend URL

  /// Initialize the Payment Sheet with a new PaymentIntent
  Future<void> initPaymentSheet({
    required int amount,
    required String currency,
    String? customerId,
  }) async {
    // 1. Create PaymentIntent on your server
    final response = await http.post(
      Uri.parse('$_baseUrl/create-payment-intent'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'amount': amount,
        'currency': currency,
        'customerId': customerId,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to create payment intent: ${response.body}');
    }

    final data = jsonDecode(response.body);

    // 2. Initialize the Payment Sheet
    await Stripe.instance.initPaymentSheet(
      paymentSheetParameters: SetupPaymentSheetParameters(
        merchantDisplayName: 'Your Store Name',
        paymentIntentClientSecret: data['paymentIntent'],
        customerEphemeralKeySecret: data['ephemeralKey'],
        customerId: data['customer'],
        // Apple Pay configuration
        applePay: const PaymentSheetApplePay(
          merchantCountryCode: 'US',
        ),
        // Google Pay configuration
        googlePay: const PaymentSheetGooglePay(
          merchantCountryCode: 'US',
          testEnv: true,  // Set to false in production
        ),
        style: ThemeMode.system,
        appearance: const PaymentSheetAppearance(
          colors: PaymentSheetAppearanceColors(
            primary: Color(0xFF6750A4),
          ),
          shapes: PaymentSheetShape(
            borderRadius: 12,
          ),
        ),
      ),
    );
  }

  /// Present the Payment Sheet and process payment
  Future<PaymentResult> presentPaymentSheet() async {
    try {
      await Stripe.instance.presentPaymentSheet();
      return PaymentResult.success();
    } on StripeException catch (e) {
      if (e.error.code == FailureCode.Canceled) {
        return PaymentResult.cancelled();
      }
      return PaymentResult.failed(e.error.localizedMessage ?? 'Payment failed');
    } catch (e) {
      return PaymentResult.failed(e.toString());
    }
  }

  /// Confirm payment (for custom flows)
  Future<void> confirmPayment() async {
    await Stripe.instance.confirmPaymentSheetPayment();
  }
}

/// Result class for payment operations
class PaymentResult {
  final bool success;
  final bool cancelled;
  final String? error;

  PaymentResult._({
    required this.success,
    required this.cancelled,
    this.error,
  });

  factory PaymentResult.success() =>
      PaymentResult._(success: true, cancelled: false);

  factory PaymentResult.cancelled() =>
      PaymentResult._(success: false, cancelled: true);

  factory PaymentResult.failed(String message) =>
      PaymentResult._(success: false, cancelled: false, error: message);
}
```

### 6. Checkout Screen

```dart
// lib/screens/checkout_screen.dart
import 'package:flutter/material.dart';
import '../services/payment_service.dart';

class CheckoutScreen extends StatefulWidget {
  final int amount;  // Amount in cents
  final String currency;

  const CheckoutScreen({
    super.key,
    required this.amount,
    this.currency = 'usd',
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final PaymentService _paymentService = PaymentService();
  bool _isLoading = false;
  bool _isPaymentSheetReady = false;

  @override
  void initState() {
    super.initState();
    _initializePayment();
  }

  Future<void> _initializePayment() async {
    setState(() => _isLoading = true);

    try {
      await _paymentService.initPaymentSheet(
        amount: widget.amount,
        currency: widget.currency,
      );
      setState(() => _isPaymentSheetReady = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _processPayment() async {
    setState(() => _isLoading = true);

    final result = await _paymentService.presentPaymentSheet();

    if (mounted) {
      setState(() => _isLoading = false);

      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment successful!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);  // Return success
      } else if (result.cancelled) {
        // User cancelled - do nothing
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment failed: ${result.error}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  String _formatAmount(int cents) {
    return '\$${(cents / 100).toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Order summary card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Order Summary',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total'),
                        Text(
                          _formatAmount(widget.amount),
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const Spacer(),
            // Pay button
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: (_isLoading || !_isPaymentSheetReady)
                    ? null
                    : _processPayment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).primaryColor,
                  foregroundColor: Colors.white,
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text('Pay ${_formatAmount(widget.amount)}'),
              ),
            ),
            const SizedBox(height: 16),
            // Security note
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lock, size: 16, color: Colors.grey),
                SizedBox(width: 8),
                Text(
                  'Secured by Stripe',
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

### 7. Testing

Use Stripe test cards for development:

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Card declined |
| 4000 0025 0000 3155 | Requires 3D Secure |

Use any future expiration date and any 3-digit CVC.

## Official Documentation

- [Stripe Flutter SDK](https://stripe.com/docs/payments/accept-a-payment?platform=flutter) - Official Flutter integration docs
- [flutter_stripe on pub.dev](https://pub.dev/packages/flutter_stripe) - Package API reference
- [Stripe Payment Sheet](https://docs.stripe.com/payments/mobile/payment-sheet) - Payment Sheet guide
- [Stripe Test Cards](https://stripe.com/docs/testing) - Test card numbers

## Common Pitfalls

### 1. "No valid Google Pay environment" Error

**Problem:** Google Pay button doesn't appear or crashes.

**Solution:** Ensure you've added the wallet metadata to AndroidManifest.xml and set the correct `testEnv` value:
```dart
googlePay: const PaymentSheetGooglePay(
  merchantCountryCode: 'US',
  testEnv: true,  // false for production
),
```

### 2. PaymentIntent Already Confirmed

**Problem:** Error when trying to pay with an already-used PaymentIntent.

**Solution:** Create a new PaymentIntent for each payment attempt. Don't reuse client secrets:
```dart
// Always call initPaymentSheet before presentPaymentSheet
await _paymentService.initPaymentSheet(amount: amount, currency: currency);
await _paymentService.presentPaymentSheet();
```

### 3. API Version Mismatch

**Problem:** Errors related to ephemeral key creation.

**Solution:** Ensure your server uses a supported API version when creating ephemeral keys:
```javascript
const ephemeralKey = await stripe.ephemeralKeys.create(
  { customer: customer.id },
  { apiVersion: '2024-06-20' }  // Use current version
);
```

### 4. Apple Pay Not Showing

**Problem:** Apple Pay option doesn't appear on iOS.

**Solution:**
1. Set `Stripe.merchantIdentifier` before initializing
2. Configure Apple Pay in your Stripe Dashboard
3. Add the merchant ID to your iOS app capabilities in Xcode
4. Use a physical device (Apple Pay doesn't work in simulator)

## Alternatives

### RevenueCat

**When to use:** If you need subscription management with in-app purchases for App Store and Google Play.

**Trade-offs:**
- Pro: Handles IAP complexity, cross-platform subscription tracking
- Con: Additional service cost, less control over payment flow

### PayPal SDK

**When to use:** If your users prefer PayPal or you need broader payment method support globally.

**Trade-offs:**
- Pro: High user trust, broad global support
- Con: Higher fees, less customizable UI

### Square SDK

**When to use:** If you also need point-of-sale or in-person payments.

**Trade-offs:**
- Pro: Unified online/offline payments
- Con: Smaller Flutter ecosystem

## Related Recipes

- [Flutter Subscriptions with RevenueCat](./flutter_revenuecat_subscriptions.md) - In-app subscriptions
- [Flutter Authentication with Supabase](./flutter_auth_supabase.md) - User management for payments
