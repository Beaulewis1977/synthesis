/**
 * Feature Detector Service
 *
 * Detects mobile features, platforms, and usage tiers from content and source URLs.
 * Used to enrich document and chunk metadata for feature-aware retrieval.
 *
 * @module services/feature-detector
 * @since GPT Phase 1: Mobile Feature Recipes
 */

import type { ContentPlatform, MobileFeatureTag, UsageTier } from '@synthesis/shared';

// =============================================================================
// Feature Detection Patterns
// =============================================================================

/**
 * Feature detection patterns for all MobileFeatureTag values.
 * Each feature has an array of regex patterns that indicate its presence.
 * Patterns are case-insensitive.
 */
const FEATURE_PATTERNS: Record<MobileFeatureTag, RegExp[]> = {
  // Authentication & Identity
  auth: [
    /\b(auth|authentication|login|logout|signin|signout|signup|register)\b/i,
    /\b(jwt|oauth|oauth2|oidc|saml|credentials)\b/i,
    /\b(firebase[_-]?auth|supabase[_-]?auth|auth0|cognito)\b/i,
  ],
  onboarding: [
    /\bonboarding\b/i,
    /\b(welcome|intro|walkthrough)\b/i,
    /first[\s_-]?run/i,
    /getting[\s_-]?started/i,
    /setup[\s_-]?wizard/i,
    /initial[\s_-]?setup/i,
  ],
  social_auth: [
    /social[\s_-]?(auth|login)/i,
    /google[\s_-]?sign[\s_-]?in/i,
    /apple[\s_-]?sign[\s_-]?in/i,
    /facebook[\s_-]?login/i,
    /twitter[\s_-]?auth/i,
    /github[\s_-]?auth/i,
    /oauth[\s_-]?provider/i,
  ],

  // Payments & Monetization
  billing: [
    /\b(billing|invoice)\b/i,
    /subscription[\s_-]?management/i,
    /revenue[\s_-]?cat/i,
    /app[\s_-]?store[\s_-]?connect/i,
  ],
  payments: [
    /\b(payment|checkout|transaction|purchase)\b/i,
    /\b(stripe|paypal|square|braintree|razorpay)\b/i,
  ],
  subscriptions: [
    /\bsubscription\b/i,
    /\bsubscribe\b/i,
    /\b(recurring|premium)\b/i,
    /in[\s_-]?app[\s_-]?purchase/i,
    /\biap\b/i,
    /store[\s_-]?kit/i,
  ],

  // Communication & Notifications
  push_notifications: [
    /push[\s_-]?notification/i,
    /remote[\s_-]?notification/i,
    /\b(fcm|apns|onesignal)\b/i,
    /firebase[\s_-]?messaging/i,
    /notification[\s_-]?(service|handler)/i,
  ],
  chat: [
    /\b(chat|messaging|conversation)\b/i,
    /direct[\s_-]?message/i,
    /stream[\s_-]?chat/i,
    /\b(sendbird|pusher)\b/i,
    /socket[\s_-]?chat/i,
  ],
  realtime: [
    /\brealtime\b/i,
    /real[\s_-]?time/i,
    /live[\s_-]?update/i,
    /\bwebsocket\b/i,
    /socket\.io/i,
    /supabase[\s_-]?realtime/i,
    /firebase[\s_-]?realtime/i,
    /\b(presence|broadcast)\b/i,
    /channel[\s_-]?subscription/i,
  ],

  // Data & Storage
  offline: [
    /\boffline\b/i,
    /offline[\s_-]?first/i,
    /local[\s_-]?(storage|database)/i,
    /\b(hive|isar|sqflite|realm|objectbox)\b/i,
    /cached[\s_-]?data/i,
    /persistent[\s_-]?storage/i,
  ],
  sync: [
    /\bsync\b/i,
    /\bsynchronize\b/i,
    /\bsynchronization\b/i,
    /data[\s_-]?sync/i,
    /background[\s_-]?sync/i,
    /conflict[\s_-]?resolution/i,
    /merge[\s_-]?strategy/i,
  ],
  caching: [
    /\b(cache|caching|cached)\b/i,
    /memory[\s_-]?cache/i,
    /image[\s_-]?cache/i,
    /http[\s_-]?cache/i,
  ],
  search: [
    /\bsearch\b/i,
    /full[\s_-]?text[\s_-]?search/i,
    /search[\s_-]?bar/i,
    /\b(algolia|elasticsearch|meilisearch|typesense)\b/i,
  ],

  // Navigation & UI
  navigation: [
    /\bnavigation\b/i,
    /\b(router|route|navigate)\b/i,
    /go[\s_-]?router/i,
    /auto[\s_-]?route/i,
    /\bnavigator\b/i,
    /page[\s_-]?transition/i,
    /bottom[\s_-]?nav/i,
    /tab[\s_-]?bar/i,
    /\bdrawer\b/i,
  ],
  state_management: [
    /state[\s_-]?management/i,
    /state[\s_-]?manager/i,
    /\b(provider|bloc|riverpod|redux|mobx|getx|cubit)\b/i,
    /\b(notifier|controller)\b/i,
    /view[\s_-]?model/i,
  ],
  forms: [
    /\bform\b/i,
    /form[\s_-]?field/i,
    /text[\s_-]?field/i,
    /input[\s_-]?field/i,
    /form[\s_-]?validation/i,
    /reactive[\s_-]?forms/i,
    /form[\s_-]?builder/i,
  ],
  theming: [
    /\b(theme|theming)\b/i,
    /dark[\s_-]?mode/i,
    /light[\s_-]?mode/i,
    /material[\s_-]?theme/i,
    /cupertino[\s_-]?theme/i,
    /color[\s_-]?scheme/i,
  ],
  localization: [
    /\blocalization\b/i,
    /\b(i18n|l10n)\b/i,
    /\b(translation|locale)\b/i,
    /\bintl\b/i,
    /\barb\b/i,
    /multi[\s_-]?language/i,
    /internationalization/i,
  ],

  // Device Features
  camera: [
    /\bcamera\b/i,
    /photo[\s_-]?capture/i,
    /video[\s_-]?capture/i,
    /qr[\s_-]?code/i,
    /\bbarcode\b/i,
    /\bscanner\b/i,
    /image[\s_-]?capture/i,
  ],
  file_upload: [
    /file[\s_-]?upload/i,
    /upload[\s_-]?file/i,
    /\bmultipart\b/i,
    /file[\s_-]?picker/i,
    /document[\s_-]?picker/i,
    /storage[\s_-]?upload/i,
  ],
  location: [
    /\blocation\b/i,
    /\bgps\b/i,
    /\b(geolocation|geolocator)\b/i,
    /\bcoordinates\b/i,
    /\b(latitude|longitude)\b/i,
    /\bgeocoding\b/i,
  ],
  maps: [
    /\bmap\b/i,
    /google[\s_-]?maps/i,
    /\b(mapbox|leaflet)\b/i,
    /apple[\s_-]?maps/i,
    /\bmarker\b/i,
    /\bpolyline\b/i,
    /\bgeofence\b/i,
    /map[\s_-]?view/i,
  ],

  // Analytics & Monitoring
  analytics: [
    /\banalytics\b/i,
    /\btracking\b/i,
    /event[\s_-]?tracking/i,
    /firebase[\s_-]?analytics/i,
    /\b(mixpanel|amplitude|segment)\b/i,
    /user[\s_-]?analytics/i,
    /app[\s_-]?analytics/i,
  ],
  deep_linking: [
    /deep[\s_-]?link/i,
    /universal[\s_-]?link/i,
    /app[\s_-]?link/i,
    /dynamic[\s_-]?link/i,
    /branch\.io/i,
    /deferred[\s_-]?deep[\s_-]?link/i,
  ],
};

// =============================================================================
// Platform Detection Patterns
// =============================================================================

/**
 * Platform detection patterns.
 * Order matters: more specific patterns should come first.
 * Mobile patterns are checked first because "React Native" should match mobile, not web.
 */
const PLATFORM_PATTERNS: Array<{ platform: ContentPlatform; patterns: RegExp[] }> = [
  {
    platform: 'mobile',
    patterns: [
      // Mobile-specific frameworks and platforms (must come first)
      /\b(flutter|dart)\b/i,
      /\b(android|ios)\b/i,
      /\bswift\b/i,
      /\bkotlin\b/i,
      /react[\s_-]?native/i,
      /\bexpo\b/i,
      // Mobile-specific terms
      /mobile[\s_-]?app/i,
      /native[\s_-]?app/i,
      /cross[\s_-]?platform/i,
      // Flutter/mobile widget patterns
      /\b(statelesswidget|statefulwidget)\b/i,
      /\bcupertino\b/i,
    ],
  },
  {
    platform: 'web',
    patterns: [
      // Web frameworks (but NOT React Native)
      /\breact\b/i, // Plain React (not React Native)
      /\b(vue|angular|svelte)\b/i,
      /\bnextjs\b/i,
      /next\.js/i,
      /\bbrowser\b/i,
      // Web-specific terms
      /web[\s_-]?app/i,
      /\bspa\b/i,
      /single[\s_-]?page/i,
      /\bfrontend\b/i,
      // DOM/browser APIs
      /\bdom\b/i,
    ],
  },
  {
    platform: 'backend',
    patterns: [
      // Backend frameworks
      /\b(node|express|fastify|nestjs)\b/i,
      /\b(postgresql|postgres)\b/i,
      /\bsupabase\b/i,
      /\bfirebase\b/i,
      // API patterns
      /\b(api|rest|graphql|grpc)\b/i,
      /\bmicroservice\b/i,
      // Backend terms
      /\bdatabase\b/i,
      /\bbackend\b/i,
      /\bmiddleware\b/i,
    ],
  },
];

// =============================================================================
// Usage Tier Detection Patterns
// =============================================================================

/**
 * Official documentation URL patterns.
 */
const OFFICIAL_URL_PATTERNS: RegExp[] = [
  /docs\.(flutter|supabase|firebase|stripe)\.dev/i,
  /developer\.(apple|android|google)\.com/i,
  /flutter\.dev/i,
  /supabase\.com\/docs/i,
  /firebase\.google\.com\/docs/i,
  /stripe\.com\/docs/i,
  /reactnative\.dev/i,
  /kotlinlang\.org/i,
  /swift\.org/i,
];

/**
 * Reference documentation URL patterns (package registries, API docs).
 */
const REFERENCE_URL_PATTERNS: RegExp[] = [
  /pub\.dev/i,
  /npmjs\.com/i,
  /pypi\.org/i,
  /crates\.io/i,
  /api\./i,
  /reference\./i,
];

/**
 * Example content patterns (in source or file path).
 */
const EXAMPLE_PATTERNS: RegExp[] = [
  /example|sample|demo|starter|template|boilerplate/i,
  /\/examples?\//i,
  /\/samples?\//i,
  /\/demo\//i,
];

/**
 * Recipe/guide content patterns.
 */
const RECIPE_PATTERNS: RegExp[] = [
  /recipe|cookbook|guide|tutorial|how[_-]?to|walkthrough/i,
  /\/recipes?\//i,
  /\/guides?\//i,
  /\/tutorials?\//i,
];

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Detects mobile features from text content.
 * Returns an array of detected feature tags, sorted alphabetically.
 *
 * @param text - The text content to analyze
 * @returns Array of detected MobileFeatureTag values
 *
 * @example
 * detectFeatures('User authentication with Supabase')
 * // → ['auth']
 *
 * @example
 * detectFeatures('Implement stripe payments and subscriptions')
 * // → ['payments', 'subscriptions']
 */
export function detectFeatures(text: string): MobileFeatureTag[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const detected: MobileFeatureTag[] = [];

  for (const [feature, patterns] of Object.entries(FEATURE_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      detected.push(feature as MobileFeatureTag);
    }
  }

  return detected.sort();
}

/**
 * Detects the content platform from text content.
 * Returns the most likely platform or undefined if no strong signals.
 *
 * @param text - The text content to analyze
 * @returns The detected ContentPlatform or undefined
 *
 * @example
 * detectPlatform('Flutter widget for iOS')
 * // → 'mobile'
 *
 * @example
 * detectPlatform('React component with hooks')
 * // → 'web'
 */
export function detectPlatform(text: string): ContentPlatform | undefined {
  if (!text || typeof text !== 'string') {
    return undefined;
  }

  // Check each platform's patterns
  for (const { platform, patterns } of PLATFORM_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return platform;
    }
  }

  return undefined;
}

/**
 * Detects the usage tier from a source URL or path.
 * Determines whether content is official docs, reference, example, or recipe.
 *
 * @param source - The source URL or file path
 * @returns The detected UsageTier (defaults to 'reference' if no match)
 *
 * @example
 * detectUsageTier('https://docs.flutter.dev/guide')
 * // → 'official'
 *
 * @example
 * detectUsageTier('https://pub.dev/packages/provider')
 * // → 'reference'
 *
 * @example
 * detectUsageTier('/recipes/flutter_auth.md')
 * // → 'recipe'
 */
export function detectUsageTier(source: string): UsageTier {
  if (!source || typeof source !== 'string') {
    return 'reference';
  }

  // Check for official documentation
  if (OFFICIAL_URL_PATTERNS.some((pattern) => pattern.test(source))) {
    return 'official';
  }

  // Check for recipe/guide content (before example to prioritize recipes)
  if (RECIPE_PATTERNS.some((pattern) => pattern.test(source))) {
    return 'recipe';
  }

  // Check for example content
  if (EXAMPLE_PATTERNS.some((pattern) => pattern.test(source))) {
    return 'example';
  }

  // Check for reference documentation
  if (REFERENCE_URL_PATTERNS.some((pattern) => pattern.test(source))) {
    return 'reference';
  }

  // Default to reference
  return 'reference';
}

/**
 * Detects all mobile metadata from content and source.
 * Convenience function that combines feature, platform, and tier detection.
 *
 * @param text - The text content to analyze
 * @param source - Optional source URL or file path
 * @returns Object with detected features, platform, and usage tier
 *
 * @example
 * detectMobileMetadata('Flutter authentication with Supabase', 'https://docs.flutter.dev/auth')
 * // → { features: ['auth'], platform: 'mobile', usageTier: 'official' }
 */
export function detectMobileMetadata(
  text: string,
  source?: string
): {
  features: MobileFeatureTag[];
  platform: ContentPlatform | undefined;
  usageTier: UsageTier;
} {
  return {
    features: detectFeatures(text),
    platform: detectPlatform(text),
    usageTier: detectUsageTier(source || ''),
  };
}
