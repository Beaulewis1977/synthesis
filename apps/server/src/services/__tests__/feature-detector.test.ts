/**
 * Feature Detector Service Tests
 *
 * @module services/__tests__/feature-detector.test
 * @since GPT Phase 1: Mobile Feature Recipes
 */

import { describe, expect, it } from 'vitest';
import {
  detectFeatures,
  detectMobileMetadata,
  detectPlatform,
  detectUsageTier,
} from '../feature-detector.js';

describe('feature-detector', () => {
  // ===========================================================================
  // detectFeatures Tests
  // ===========================================================================
  describe('detectFeatures', () => {
    describe('Authentication & Identity', () => {
      it('detects auth features', () => {
        expect(detectFeatures('User authentication with Supabase')).toContain('auth');
        expect(detectFeatures('Implement login and logout')).toContain('auth');
        expect(detectFeatures('JWT token validation')).toContain('auth');
        expect(detectFeatures('firebase_auth package')).toContain('auth');
      });

      it('detects onboarding features', () => {
        expect(detectFeatures('User onboarding flow')).toContain('onboarding');
        expect(detectFeatures('Welcome screen tutorial')).toContain('onboarding');
        expect(detectFeatures('Getting started wizard')).toContain('onboarding');
      });

      it('detects social_auth features', () => {
        expect(detectFeatures('Google sign-in integration')).toContain('social_auth');
        expect(detectFeatures('Apple Sign In button')).toContain('social_auth');
        expect(detectFeatures('Social login with Facebook')).toContain('social_auth');
      });
    });

    describe('Payments & Monetization', () => {
      it('detects billing features', () => {
        expect(detectFeatures('Billing management system')).toContain('billing');
        expect(detectFeatures('RevenueCat integration')).toContain('billing');
        expect(detectFeatures('Generate invoice PDF')).toContain('billing');
      });

      it('detects payments features', () => {
        expect(detectFeatures('Stripe payment integration')).toContain('payments');
        expect(detectFeatures('Process checkout transaction')).toContain('payments');
        expect(detectFeatures('PayPal payment button')).toContain('payments');
      });

      it('detects subscriptions features', () => {
        expect(detectFeatures('Subscription management')).toContain('subscriptions');
        expect(detectFeatures('In-app purchase flow')).toContain('subscriptions');
        expect(detectFeatures('Premium tier upgrade')).toContain('subscriptions');
      });
    });

    describe('Communication & Notifications', () => {
      it('detects push_notifications features', () => {
        expect(detectFeatures('Push notification handler')).toContain('push_notifications');
        expect(detectFeatures('FCM integration')).toContain('push_notifications');
        expect(detectFeatures('APNS configuration')).toContain('push_notifications');
        expect(detectFeatures('OneSignal setup')).toContain('push_notifications');
      });

      it('detects chat features', () => {
        expect(detectFeatures('Real-time chat implementation')).toContain('chat');
        expect(detectFeatures('Direct messaging system')).toContain('chat');
        expect(detectFeatures('Stream Chat SDK')).toContain('chat');
      });

      it('detects realtime features', () => {
        expect(detectFeatures('WebSocket connection')).toContain('realtime');
        expect(detectFeatures('Supabase realtime subscription')).toContain('realtime');
        expect(detectFeatures('Live updates with Socket.io')).toContain('realtime');
      });
    });

    describe('Data & Storage', () => {
      it('detects offline features', () => {
        expect(detectFeatures('Offline-first architecture')).toContain('offline');
        expect(detectFeatures('Offline mode with cached data')).toContain('offline');
        expect(detectFeatures('Persistent storage for offline use')).toContain('offline');
      });

      it('detects local_storage features', () => {
        // GPT Phase 1: local_storage is now a separate feature tag
        expect(detectFeatures('Local database with SQLite')).toContain('local_storage');
        expect(detectFeatures('Hive storage implementation')).toContain('local_storage');
        expect(detectFeatures('Isar database')).toContain('local_storage');
        expect(detectFeatures('Shared preferences storage')).toContain('local_storage');
        expect(detectFeatures('Secure storage for credentials')).toContain('local_storage');
      });

      it('detects sync features', () => {
        expect(detectFeatures('Data synchronization')).toContain('sync');
        expect(detectFeatures('Background sync task')).toContain('sync');
        expect(detectFeatures('Conflict resolution strategy')).toContain('sync');
      });

      it('detects caching features', () => {
        expect(detectFeatures('Image caching strategy')).toContain('caching');
        expect(detectFeatures('Redis cache integration')).toContain('caching');
        expect(detectFeatures('Memory cache implementation')).toContain('caching');
      });

      it('detects search features', () => {
        expect(detectFeatures('Full-text search implementation')).toContain('search');
        expect(detectFeatures('Algolia search integration')).toContain('search');
        expect(detectFeatures('Search bar component')).toContain('search');
      });
    });

    describe('Navigation & UI', () => {
      it('detects navigation features', () => {
        expect(detectFeatures('Navigation with GoRouter')).toContain('navigation');
        expect(detectFeatures('Auto route configuration')).toContain('navigation');
        expect(detectFeatures('Bottom navigation bar')).toContain('navigation');
        expect(detectFeatures('Tab bar implementation')).toContain('navigation');
      });

      it('detects state_management features', () => {
        expect(detectFeatures('State management with BLoC')).toContain('state_management');
        expect(detectFeatures('Riverpod provider setup')).toContain('state_management');
        expect(detectFeatures('Redux store configuration')).toContain('state_management');
        expect(detectFeatures('GetX controller')).toContain('state_management');
      });

      it('detects forms features', () => {
        expect(detectFeatures('Form validation logic')).toContain('forms');
        expect(detectFeatures('TextFormField widget')).toContain('forms');
        expect(detectFeatures('Reactive forms builder')).toContain('forms');
      });

      it('detects theming features', () => {
        expect(detectFeatures('Dark mode toggle')).toContain('theming');
        expect(detectFeatures('Material theme configuration')).toContain('theming');
        expect(detectFeatures('Color scheme customization')).toContain('theming');
      });

      it('detects localization features', () => {
        expect(detectFeatures('Multi-language support')).toContain('localization');
        expect(detectFeatures('i18n configuration')).toContain('localization');
        expect(detectFeatures('ARB file translation')).toContain('localization');
      });
    });

    describe('Device Features', () => {
      it('detects camera features', () => {
        expect(detectFeatures('Camera capture implementation')).toContain('camera');
        expect(detectFeatures('QR code scanner')).toContain('camera');
        expect(detectFeatures('Barcode reader')).toContain('camera');
      });

      it('detects file_upload features', () => {
        expect(detectFeatures('File upload functionality')).toContain('file_upload');
        expect(detectFeatures('Document picker integration')).toContain('file_upload');
        expect(detectFeatures('Multipart file upload')).toContain('file_upload');
      });

      it('detects location features', () => {
        expect(detectFeatures('GPS location tracking')).toContain('location');
        expect(detectFeatures('Geolocation service')).toContain('location');
        expect(detectFeatures('Get user coordinates')).toContain('location');
      });

      it('detects maps features', () => {
        expect(detectFeatures('Google Maps integration')).toContain('maps');
        expect(detectFeatures('Mapbox implementation')).toContain('maps');
        expect(detectFeatures('Map marker placement')).toContain('maps');
      });
    });

    describe('Analytics & Monitoring', () => {
      it('detects analytics features', () => {
        expect(detectFeatures('Firebase Analytics setup')).toContain('analytics');
        expect(detectFeatures('Mixpanel event tracking')).toContain('analytics');
        expect(detectFeatures('User analytics dashboard')).toContain('analytics');
      });

      it('detects deep_linking features', () => {
        expect(detectFeatures('Deep link handling')).toContain('deep_linking');
        expect(detectFeatures('Universal links configuration')).toContain('deep_linking');
        expect(detectFeatures('Branch.io integration')).toContain('deep_linking');
      });
    });

    describe('Edge Cases', () => {
      it('returns empty array for empty string', () => {
        expect(detectFeatures('')).toEqual([]);
      });

      it('returns empty array for null/undefined', () => {
        expect(detectFeatures(null as unknown as string)).toEqual([]);
        expect(detectFeatures(undefined as unknown as string)).toEqual([]);
      });

      it('returns empty array for content with no features', () => {
        expect(detectFeatures('Hello world')).toEqual([]);
        expect(detectFeatures('Just some random text')).toEqual([]);
      });

      it('detects multiple features in same content', () => {
        const features = detectFeatures(
          'Implement authentication with Stripe payments and push notifications'
        );
        expect(features).toContain('auth');
        expect(features).toContain('payments');
        expect(features).toContain('push_notifications');
      });

      it('returns features sorted alphabetically', () => {
        const features = detectFeatures('payment and auth and sync');
        expect(features).toEqual(['auth', 'payments', 'sync']);
      });
    });
  });

  // ===========================================================================
  // detectPlatform Tests
  // ===========================================================================
  describe('detectPlatform', () => {
    describe('Mobile Platform Detection', () => {
      it('detects Flutter as mobile', () => {
        expect(detectPlatform('Flutter widget for iOS')).toBe('mobile');
        expect(detectPlatform('Dart code for Android')).toBe('mobile');
      });

      it('detects React Native as mobile', () => {
        expect(detectPlatform('React Native component')).toBe('mobile');
        expect(detectPlatform('Expo managed workflow')).toBe('mobile');
      });

      it('detects native platforms as mobile', () => {
        expect(detectPlatform('Swift iOS development')).toBe('mobile');
        expect(detectPlatform('Kotlin Android app')).toBe('mobile');
      });

      it('detects mobile keywords', () => {
        expect(detectPlatform('Mobile app development')).toBe('mobile');
        expect(detectPlatform('Cross-platform solution')).toBe('mobile');
        expect(detectPlatform('StatefulWidget implementation')).toBe('mobile');
      });
    });

    describe('Web Platform Detection', () => {
      it('detects React (web) as web', () => {
        expect(detectPlatform('React hooks tutorial')).toBe('web');
        expect(detectPlatform('Vue.js component')).toBe('web');
        expect(detectPlatform('Angular service')).toBe('web');
      });

      it('detects Next.js as web', () => {
        expect(detectPlatform('Next.js server components')).toBe('web');
        expect(detectPlatform('Svelte store')).toBe('web');
      });

      it('detects web keywords', () => {
        expect(detectPlatform('Web app frontend')).toBe('web');
        expect(detectPlatform('Single page application')).toBe('web');
        expect(detectPlatform('Browser DOM manipulation')).toBe('web');
      });
    });

    describe('Backend Platform Detection', () => {
      it('detects Node.js as backend', () => {
        expect(detectPlatform('Node.js server')).toBe('backend');
        expect(detectPlatform('Express middleware')).toBe('backend');
        expect(detectPlatform('Fastify plugin')).toBe('backend');
      });

      it('detects databases as backend', () => {
        expect(detectPlatform('PostgreSQL query')).toBe('backend');
        expect(detectPlatform('Supabase functions')).toBe('backend');
        expect(detectPlatform('Firebase backend')).toBe('backend');
      });

      it('detects API keywords as backend', () => {
        expect(detectPlatform('REST API endpoint')).toBe('backend');
        expect(detectPlatform('GraphQL resolver')).toBe('backend');
        expect(detectPlatform('Microservice architecture')).toBe('backend');
      });
    });

    describe('Edge Cases', () => {
      it('returns undefined for empty string', () => {
        expect(detectPlatform('')).toBeUndefined();
      });

      it('returns undefined for null/undefined', () => {
        expect(detectPlatform(null as unknown as string)).toBeUndefined();
        expect(detectPlatform(undefined as unknown as string)).toBeUndefined();
      });

      it('returns undefined for generic content', () => {
        expect(detectPlatform('Hello world')).toBeUndefined();
        expect(detectPlatform('Generic programming concepts')).toBeUndefined();
      });

      it('returns first matching platform for mixed content', () => {
        // Mobile patterns come first, so Flutter wins
        expect(detectPlatform('Flutter and React integration')).toBe('mobile');
      });
    });
  });

  // ===========================================================================
  // detectUsageTier Tests
  // ===========================================================================
  describe('detectUsageTier', () => {
    describe('Official Documentation', () => {
      it('detects Flutter docs as official', () => {
        expect(detectUsageTier('https://docs.flutter.dev/guide')).toBe('official');
        expect(detectUsageTier('https://flutter.dev/docs/cookbook')).toBe('official');
      });

      it('detects Supabase docs as official', () => {
        expect(detectUsageTier('https://supabase.com/docs/guides/auth')).toBe('official');
      });

      it('detects Firebase docs as official', () => {
        expect(detectUsageTier('https://firebase.google.com/docs/auth')).toBe('official');
      });

      it('detects Stripe docs as official', () => {
        expect(detectUsageTier('https://stripe.com/docs/payments')).toBe('official');
        expect(detectUsageTier('https://docs.stripe.dev/api')).toBe('official');
      });

      it('detects Apple/Google developer docs as official', () => {
        expect(detectUsageTier('https://developer.apple.com/documentation')).toBe('official');
        expect(detectUsageTier('https://developer.android.com/guide')).toBe('official');
        expect(detectUsageTier('https://developer.google.com/identity')).toBe('official');
      });
    });

    describe('Reference Documentation', () => {
      it('detects pub.dev as reference', () => {
        expect(detectUsageTier('https://pub.dev/packages/provider')).toBe('reference');
      });

      it('detects npm as reference', () => {
        expect(detectUsageTier('https://npmjs.com/package/express')).toBe('reference');
      });

      it('detects generic API docs as reference', () => {
        // api.flutter.dev is actually official Flutter docs, so use a generic URL
        expect(detectUsageTier('https://api.myservice.com/v1/docs')).toBe('reference');
      });
    });

    describe('Example Content', () => {
      it('detects example in path', () => {
        expect(detectUsageTier('/path/to/examples/auth.dart')).toBe('example');
        expect(detectUsageTier('https://github.com/repo/samples/app')).toBe('example');
      });

      it('detects demo/starter in source', () => {
        expect(detectUsageTier('flutter-demo-app')).toBe('example');
        expect(detectUsageTier('react-starter-template')).toBe('example');
        expect(detectUsageTier('sample-boilerplate')).toBe('example');
      });
    });

    describe('Recipe Content', () => {
      it('detects recipe in path', () => {
        expect(detectUsageTier('/docs/recipes/auth.md')).toBe('recipe');
        expect(detectUsageTier('/cookbook/state-management.md')).toBe('recipe');
      });

      it('detects guide/tutorial in source', () => {
        expect(detectUsageTier('flutter-auth-guide')).toBe('recipe');
        expect(detectUsageTier('how-to-implement-payments')).toBe('recipe');
        expect(detectUsageTier('/tutorials/getting-started')).toBe('recipe');
      });
    });

    describe('Edge Cases', () => {
      it('returns reference for empty string', () => {
        expect(detectUsageTier('')).toBe('reference');
      });

      it('returns reference for null/undefined', () => {
        expect(detectUsageTier(null as unknown as string)).toBe('reference');
        expect(detectUsageTier(undefined as unknown as string)).toBe('reference');
      });

      it('returns reference for unknown sources', () => {
        expect(detectUsageTier('https://randomsite.com/page')).toBe('reference');
        expect(detectUsageTier('/some/random/path.ts')).toBe('reference');
      });

      it('prioritizes recipe over example when both match', () => {
        expect(detectUsageTier('/recipes/example-auth.md')).toBe('recipe');
      });
    });
  });

  // ===========================================================================
  // detectMobileMetadata Tests
  // ===========================================================================
  describe('detectMobileMetadata', () => {
    it('combines all detection functions', () => {
      const result = detectMobileMetadata(
        'Flutter authentication with Supabase',
        'https://docs.flutter.dev/auth'
      );

      expect(result.features).toContain('auth');
      expect(result.platform).toBe('mobile');
      expect(result.usageTier).toBe('official');
    });

    it('handles missing source', () => {
      const result = detectMobileMetadata('Flutter navigation with GoRouter');

      expect(result.features).toContain('navigation');
      expect(result.platform).toBe('mobile');
      expect(result.usageTier).toBe('reference');
    });

    it('handles content with no features', () => {
      const result = detectMobileMetadata('Hello world', 'https://randomsite.com');

      expect(result.features).toEqual([]);
      expect(result.platform).toBeUndefined();
      expect(result.usageTier).toBe('reference');
    });

    it('detects multiple features with platform and tier', () => {
      const result = detectMobileMetadata(
        'Implement Stripe payments and push notifications in Flutter',
        'https://pub.dev/packages/stripe'
      );

      expect(result.features).toContain('payments');
      expect(result.features).toContain('push_notifications');
      expect(result.platform).toBe('mobile');
      expect(result.usageTier).toBe('reference');
    });
  });
});
