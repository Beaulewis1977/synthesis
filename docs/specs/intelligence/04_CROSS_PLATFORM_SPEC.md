# React Native & Cross-Platform Intelligence Specification

**Goal:** Enable Synthesis to understand cross-platform architectures (Bridge, Native Modules, JS/Native boundary).
**Target Level:** L3 (Semantic Tagging)

---

## 1. React Native Intelligence (`react-native-analyzer.ts`)

**Parser:** `tree-sitter-typescript` / `tree-sitter-javascript` (Existing) + Extension logic.

### Role Detection Heuristics

| Role | Pattern / Heuristic | Example |
|------|---------------------|---------|
| `ui_component` | Functions returning `<View>`, `<Text>`, `<ScrollView>` | `export function UserScreen() { ... }` |
| `native_module` | `NativeModules.X`, `TurboModule` definitions | `import { NativeModules } from 'react-native'` |
| `navigation` | `Stack.Navigator`, `Tab.Navigator` definitions | `<Stack.Navigator>` |
| `animation` | Usage of `Animated.*`, `Reanimated` | `const opacity = useSharedValue(0)` |
| `platform_specific` | Files ending in `.ios.js`, `.android.js` | `Button.ios.js` |

### Bridge & Native Linking
*   **Native Module Mapping:** If a JS file imports `NativeModules.Calendar`, the system should attempt to find the corresponding Java/Kotlin (`@ReactMethod`) or ObjC/Swift (`RCT_EXPORT_METHOD`) code in the `android/` or `ios/` folders.
*   **CocoaPods/Gradle:** Parse `Podfile` and `build.gradle` to identify linked native libraries.

---

## 2. Redis Intelligence (`redis-analyzer.ts`)

**Parser:** `regex` (for config) + `code-analysis` (scanning usage in backend code).

### Role Detection
*   **Configuration:** `redis.conf` files.
*   **Usage Scanner:** Scan backend code (Node/Python/Go) for Redis client calls:
    *   `redis.set`, `redis.get` -> `caching`
    *   `redis.publish`, `redis.subscribe` -> `messaging` (Pub/Sub)
    *   `lpush`, `rpop` -> `queue`

### Key Patterns to Tag
*   **Cache Keys:** Attempt to extract string patterns used in keys (e.g., `user:{id}:session`). *Usage:* Helps LLM understand the cache key namespace to avoid collisions.

---

## 3. Firebase / Firestore Intelligence

**Parser:** `typescript` (for Functions) + `json` (for rules/indexes).

### Firestore Rules (`firestore.rules`)
*   **Role:** `security_policy` (Similar to Supabase RLS).
*   **Extraction:** Extract `match /collection/{doc} { allow read, write: if ... }` blocks.
*   **Goal:** LLM must understand *who* can read data.

### Cloud Functions (`index.ts`)
*   **Role:** `serverless_function`
*   **Triggers:** Detect `functions.firestore.document(...).onCreate`, `.onUpdate`.
*   **Goal:** Map database events to backend logic.

### Frontend SDK Usage
*   **Auth:** Detect `signInWithEmailAndPassword`, `onAuthStateChanged`.
*   **Analytics:** Detect `logEvent` calls to understand what business metrics are tracked.

