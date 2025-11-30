---
# =============================================================================
# Recipe Frontmatter Schema
# =============================================================================
# All fields are parsed during ingestion and used for feature-aware retrieval.

# REQUIRED FIELDS
title: "Recipe Title"                    # Human-readable title
platform: mobile                         # ContentPlatform: mobile | web | backend | shared
framework: flutter                       # DocumentFramework: flutter | dart | supabase | firebase | etc.
feature_tags:                            # MobileFeatureTag[]: at least one required
  - auth                                 # Primary feature
  - social_auth                          # Secondary features (optional)
usage_tier: recipe                       # UsageTier: always 'recipe' for recipe docs

# RECOMMENDED FIELDS
framework_version: "3.24.x"              # Target framework version
tech_stack:                              # Related technologies
  - supabase
  - flutter
difficulty: intermediate                 # beginner | intermediate | advanced
last_updated: 2025-11-30                 # ISO date of last update

# OPTIONAL FIELDS
recommended: true                        # Mark as recommended for this feature
author: "Your Name"                      # Recipe author
sdk_constraints: ">=3.0.0 <4.0.0"        # Dart/Flutter SDK constraints
tested_versions:                         # Versions this was tested with
  - "Flutter 3.24.5"
  - "Supabase 2.0.0"
---

# {Recipe Title}

> **Summary:** One to three sentences describing the recommended approach and what this recipe covers. Be specific about the use case.

## Prerequisites

Before starting, ensure you have:

- [ ] Flutter SDK {version} installed
- [ ] {Required tool/service} account set up
- [ ] Basic understanding of {concept}

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Flutter   | 3.24.x  | UI framework |
| {Package} | ^X.Y.Z  | {Purpose} |

## Step-by-Step Implementation

### 1. Project Setup

{Brief description of this step}

```dart
// pubspec.yaml
dependencies:
  package_name: ^X.Y.Z
```

```bash
flutter pub get
```

### 2. Configuration

{Description}

```dart
// Code example with comments
```

### 3. Core Implementation

{Description}

```dart
// Main implementation code
```

### 4. UI Integration

{Description}

```dart
// Widget code
```

### 5. Error Handling

{Description}

```dart
// Error handling patterns
```

### 6. Testing

{Description}

```dart
// Test examples
```

## Official Documentation

- [{Framework/Service} Official Docs]({URL}) - {Brief description}
- [{Package} on pub.dev]({URL}) - API reference
- [{Additional resource}]({URL}) - {Description}

## Common Pitfalls

### 1. {Pitfall Name}

**Problem:** {Description of what goes wrong}

**Solution:**
```dart
// Fix code
```

### 2. {Pitfall Name}

**Problem:** {Description}

**Solution:** {Description or code}

## Alternatives

### {Alternative Approach 1}

**When to use:** {Scenario where this is better}

**Trade-offs:**
- Pro: {Benefit}
- Con: {Drawback}

### {Alternative Approach 2}

**When to use:** {Scenario}

**Trade-offs:**
- Pro: {Benefit}
- Con: {Drawback}

## Related Recipes

- [{Related Recipe 1}](./related_recipe_1.md) - {Brief description}
- [{Related Recipe 2}](./related_recipe_2.md) - {Brief description}
