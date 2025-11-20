# Mobile Intelligence Specification (Android & iOS)

**Goal:** Enable Synthesis to understand native mobile architectures (MVVM, MVP, Clean Arch).
**Target Level:** L3 (Semantic Tagging)

---

## 1. Android (Kotlin) Intelligence (`kotlin-analyzer.ts`)

**Parser:** `tree-sitter-kotlin`

### Role Detection Heuristics

| Role | Pattern / Heuristic | Example |
|------|---------------------|---------|
| `ui_component` | (Compose) Functions annotated with `@Composable` | `@Composable fun UserProfile(...)` |
| `ui_component` | (Classic) Classes extending `Activity`, `Fragment`, `View` | `class MainActivity : AppCompatActivity()` |
| `state_manager` | Classes extending `ViewModel`, `AndroidViewModel` | `class UserViewModel : ViewModel()` |
| `data_model` | Data classes, classes with `@Entity` (Room), `@Serializable` | `data class User(...)` |
| `dependency_injection` | Classes/Functions with `@Module`, `@Provides`, `@InstallIn` (Hilt/Dagger) | `@Module object NetworkModule` |
| `network_interface` | Interfaces with `@GET`, `@POST` (Retrofit) | `interface UserApi` |

### Metadata Extraction
*   **Compose Previews:** Identify chunks marked `@Preview`. *Usage:* These are isolated UI examples, great for few-shot prompting.
*   **Navigation:** Extract route strings from `composable("route") { ... }`.

---

## 2. iOS (Swift) Intelligence (`swift-analyzer.ts`)

**Parser:** `tree-sitter-swift`

### Role Detection Heuristics

| Role | Pattern / Heuristic | Example |
|------|---------------------|---------|
| `ui_component` | (SwiftUI) Structs conforming to `View` | `struct UserView: View` |
| `ui_component` | (UIKit) Classes inheriting `UIViewController`, `UIView` | `class UserViewController: UIViewController` |
| `state_manager` | Classes conforming to `ObservableObject` | `class UserStore: ObservableObject` |
| `data_model` | Structs conforming to `Codable`, `Identifiable` | `struct User: Codable` |
| `preview` | Structs conforming to `PreviewProvider` | `struct UserView_Previews: PreviewProvider` |

### Metadata Extraction
*   **Modifiers:** In SwiftUI, extract common modifiers (`.padding()`, `.background()`) to understand styling usage.
*   **Property Wrappers:** Tag variables using `@State`, `@Binding`, `@EnvironmentObject`, `@Published`. *Usage:* Critical for LLM to understand data flow.

---

## 3. Flutter/Dart Extensions (`dart-analyzer.ts`)

**Current Status:** **Excellent** (Level 3).
**Enhancements Needed (High Priority):**
*   **Bloc/Cubit Detection:** Explicitly tag classes extending `Bloc` or `Cubit` as `state_manager`.
*   **Riverpod Detection:** Tag global providers (`Provider`, `StateNotifierProvider`) as `dependency_injection`.
*   **Freezed:** Detect `@freezed` annotation to better understand immutable data models.
*   **Supabase:** Detect `Supabase.instance.client` usage -> `data_access`.
*   **RevenueCat:** Detect `Purchases.configure` -> `subscription_config`.

