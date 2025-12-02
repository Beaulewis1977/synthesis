# Scenario: Firebase Push Notifications

## Overview

- **Goal**: Agent adds Firebase Cloud Messaging (FCM) push notifications to a cross-platform Flutter app for Android and iOS
- **Starting Collection**: `placeholder-collection-id` (Firebase docs + Flutter examples + notification recipes)
- **Primary Tools**: `get_feature_recipe`, `find_code_examples`, `get_project_tech_stack`, `search_mobile_docs`
- **Category**: Push Notifications
- **Difficulty**: Medium

## Preconditions

- Collection contains:
  - Firebase official documentation
  - Flutter FCM examples
  - Push notification recipes
  - Platform-specific setup guides (Android/iOS)
- Project may or may not have existing Firebase setup

## Workflow Steps

### Step 1: Get Push Notification Recipe

**Tool**: `get_feature_recipe`
**Purpose**: Retrieve the recommended pattern for FCM implementation

```json
{
  "featureTags": ["push_notifications"],
  "framework": "flutter",
  "tech_stack": ["firebase"]
}
```

**Expected Results**:
- Complete FCM setup recipe
- Android and iOS configuration steps
- Background/foreground handling patterns
- Permission request flow

**Success Criteria**:
- At least 1 recipe result returned
- Result contains platform-specific setup
- Covers both Android and iOS

---

### Step 2: Find FCM Code Examples

**Tool**: `find_code_examples`
**Purpose**: Get working Flutter FCM implementation code

```json
{
  "feature": "firebase messaging fcm push notification",
  "framework": "flutter",
  "tech_stack": ["firebase"],
  "limit": 5
}
```

**Expected Results**:
- Firebase Messaging initialization code
- Notification handler implementations
- Token management code
- Local notification display

**Success Criteria**:
- At least 2 code examples returned
- Examples include firebase_messaging package
- Background message handler present

---

### Step 3: Check Existing Firebase Setup

**Tool**: `get_project_tech_stack`
**Purpose**: Determine if Firebase is already configured in the project

```json
{
  "collectionId": "placeholder-collection-id"
}
```

**Expected Results**:
- Firebase configuration status
- Existing Firebase services in use
- google-services.json / GoogleService-Info.plist presence

**Success Criteria**:
- Tech stack profile returned
- Firebase services listed if present
- Platform configurations identified

---

### Step 4: Search Platform Setup Docs

**Tool**: `search_mobile_docs`
**Purpose**: Get platform-specific FCM configuration documentation

```json
{
  "query": "firebase fcm android ios setup configuration APNs",
  "framework": "flutter",
  "featureTags": ["push_notifications"],
  "platform": "mobile"
}
```

**Expected Results**:
- Android FCM setup (google-services.json, manifest)
- iOS APNs configuration
- Certificate/key setup instructions
- Testing procedures

**Success Criteria**:
- At least 2 results returned
- Both Android and iOS covered
- Configuration file instructions included

---

## Success Criteria Summary

| Criterion | Required |
|-----------|----------|
| `get_feature_recipe` called | Yes |
| `find_code_examples` called | Yes |
| `get_project_tech_stack` called | Yes |
| `search_mobile_docs` called | Yes |
| FCM recipe found | Yes |
| Platform setup docs found | Yes |
| Total tool calls | >= 4 |

## Expected Outcome

After completing this scenario, the agent should have gathered:

1. **Implementation pattern**: Recommended FCM architecture
2. **Code examples**: Flutter notification handling code
3. **Project context**: Existing Firebase setup status
4. **Platform guides**: Android and iOS specific configuration

This information enables the agent to:
- Add firebase_messaging and flutter_local_notifications packages
- Configure Android (google-services.json, manifest permissions)
- Configure iOS (APNs, entitlements, Info.plist)
- Implement foreground/background notification handlers
- Set up notification channels (Android)

## Workflow Diagram

```
[get_feature_recipe] → Get FCM implementation pattern
          ↓
[find_code_examples] → Get Flutter notification code
          ↓
[get_project_tech_stack] → Check existing Firebase setup
          ↓
[search_mobile_docs] → Get Android/iOS config guides
```

## Platform-Specific Considerations

### Android
- google-services.json in android/app/
- Notification channels for Android 8+
- ProGuard rules if minified

### iOS
- APNs certificate or key in Firebase Console
- Push Notifications capability in Xcode
- Background Modes capability

## Anti-Patterns

- Implementing push notifications without checking platform requirements
- Forgetting background message handler (causes crashes)
- Not requesting notification permissions on iOS
- Skipping notification channels on Android

## Notes

This scenario tests cross-platform feature implementation where the agent must gather platform-specific documentation in addition to the general recipe. The `get_project_tech_stack` call helps avoid duplicate Firebase configuration.
