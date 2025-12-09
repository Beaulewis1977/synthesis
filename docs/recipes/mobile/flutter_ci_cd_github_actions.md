---
title: "Flutter CI/CD with GitHub Actions"
platform: mobile
framework: flutter
feature_tags:
  - ci_cd
  - devops
usage_tier: recipe
framework_version: "3.24.x"
tech_stack:
  - github_actions
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
---

# Flutter CI/CD with GitHub Actions

> **Summary:** Automate your Flutter workflow. Run tests and static analysis on every Pull Request, and build Android App Bundles (AAB) for Play Store releases on version tags.
>
> **Note:** This recipe builds AAB (Android App Bundle), which is the preferred format for Google Play Store due to smaller size and dynamic delivery. APK and IPA (iOS) builds are not included.

## Prerequisites

- [ ] GitHub Repository

## Step-by-Step Implementation

### 1. PR Checks Workflow

Create `.github/workflows/flutter-checks.yaml`

```yaml
name: Flutter Checks

on:
  pull_request:
    branches: [ main, develop ]

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: subosito/flutter-action@v2
        with:
          channel: 'stable'
          cache: true
          
      - name: Get Dependencies
        run: flutter pub get
        
      - name: Check Formatting
        run: dart format --output=none --set-exit-if-changed .
        
      - name: Analyze
        run: flutter analyze
        
      - name: Run Tests
        run: flutter test
```

### 2. Build Artifacts Workflow

Create `.github/workflows/flutter-build.yaml`

```yaml
name: Build Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          cache: true
      
      - name: Decode Keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > android/app/upload-keystore.jks
          
      - name: Create key.properties
        run: |
          echo "storePassword=${{ secrets.KEYSTORE_PASSWORD }}" > android/key.properties
          echo "keyPassword=${{ secrets.KEYSTORE_PASSWORD }}" >> android/key.properties
          echo "keyAlias=upload" >> android/key.properties  # Must match your keystore alias
          echo "storeFile=upload-keystore.jks" >> android/key.properties
          
      - name: Build App Bundle
        run: flutter build appbundle
        
      - uses: actions/upload-artifact@v4
        with:
          name: app-release.aab
          path: build/app/outputs/bundle/release/app-release.aab
```

## Common Pitfalls

### 1. Secrets Management

**Problem:** Committing passwords or keystores to git.

**Solution:** Use GitHub Secrets. Encode your keystore file to base64 (`base64 -i upload.jks -o key.txt`) and store the string content as a secret.

### 2. Keystore Alias Mismatch

**Problem:** Build fails with "alias does not exist" error.

**Solution:** Ensure your keystore's key alias matches the value in `key.properties` (line 91 uses `upload`). Verify your alias with:

```bash
keytool -list -v -keystore upload.jks
```

### 3. Cache Misses

**Problem:** Builds take too long re-downloading packages.

**Solution:** The `subosito/flutter-action` supports `cache: true` which handles pub cache automatically.
