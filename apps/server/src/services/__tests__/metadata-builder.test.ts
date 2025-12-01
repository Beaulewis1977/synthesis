import { describe, expect, it } from 'vitest';
import { MetadataBuilder, buildMetadata } from '../metadata-builder.js';

describe('MetadataBuilder', () => {
  // ===========================================================================
  // GPT Phase 1: Mobile Feature Metadata Methods
  // ===========================================================================
  describe('Mobile Metadata Methods (GPT Phase 1)', () => {
    it('sets platform correctly', () => {
      const metadata = buildMetadata().setPlatform('mobile').build();
      expect(metadata.platform).toBe('mobile');
    });

    it('sets feature_tags with setFeatureTags', () => {
      const metadata = buildMetadata().setFeatureTags(['auth', 'payments']).build();
      expect(metadata.feature_tags).toEqual(['auth', 'payments']);
    });

    it('adds to existing feature_tags with addFeatureTags', () => {
      const metadata = buildMetadata()
        .setFeatureTags(['auth'])
        .addFeatureTags('payments', 'push_notifications')
        .build();
      expect(metadata.feature_tags).toEqual(['auth', 'payments', 'push_notifications']);
    });

    it('addFeatureTags works with no existing tags', () => {
      const metadata = buildMetadata().addFeatureTags('offline', 'sync').build();
      expect(metadata.feature_tags).toEqual(['offline', 'sync']);
    });

    it('sets usage_tier correctly', () => {
      const metadata = buildMetadata().setUsageTier('recipe').build();
      expect(metadata.usage_tier).toBe('recipe');
    });

    it('sets recommended flag', () => {
      const metadata = buildMetadata().setRecommended(true).build();
      expect(metadata.recommended).toBe(true);

      const metadata2 = buildMetadata().setRecommended(false).build();
      expect(metadata2.recommended).toBe(false);
    });

    it('chains all mobile metadata methods together', () => {
      const metadata = buildMetadata()
        .setPlatform('mobile')
        .setFeatureTags(['auth', 'social_auth'])
        .setUsageTier('recipe')
        .setRecommended(true)
        .setDocType('recipe')
        .setFramework('flutter', '3.24.5')
        .build();

      expect(metadata.platform).toBe('mobile');
      expect(metadata.feature_tags).toEqual(['auth', 'social_auth']);
      expect(metadata.usage_tier).toBe('recipe');
      expect(metadata.recommended).toBe(true);
      expect(metadata.doc_type).toBe('recipe');
      expect(metadata.framework).toBe('flutter');
      expect(metadata.framework_version).toBe('3.24.5');
    });

    it('builds complete recipe metadata', () => {
      const metadata = buildMetadata()
        .setPlatform('mobile')
        .setFeatureTags(['payments', 'billing'])
        .setUsageTier('recipe')
        .setRecommended(true)
        .setDocType('recipe')
        .setSourceUrl('file:///docs/recipes/flutter_stripe_payments.md')
        .setSourceQuality('official')
        .setFramework('flutter', '3.24.x')
        .setSdkConstraints('>=3.0.0 <4.0.0')
        .build();

      expect(metadata).toMatchObject({
        platform: 'mobile',
        feature_tags: ['payments', 'billing'],
        usage_tier: 'recipe',
        recommended: true,
        doc_type: 'recipe',
        source_url: 'file:///docs/recipes/flutter_stripe_payments.md',
        source_quality: 'official',
        framework: 'flutter',
        framework_version: '3.24.x',
        sdk_constraints: '>=3.0.0 <4.0.0',
      });
    });

    it('preserves mobile metadata when merging with defaults', () => {
      const defaults = {
        platform: 'web' as const,
        feature_tags: ['navigation'] as const,
      };

      const metadata = buildMetadata()
        .setPlatform('mobile')
        .setFeatureTags(['auth'])
        .build(defaults);

      // Builder values should override defaults
      expect(metadata.platform).toBe('mobile');
      expect(metadata.feature_tags).toEqual(['auth']);
    });
  });

  // ===========================================================================
  // Original Tests
  // ===========================================================================
  it('builds metadata with explicit values', () => {
    const metadata = buildMetadata()
      .setDocType('official_doc')
      .setSourceUrl('https://flutter.dev/docs/auth')
      .setSourceAuthor('Flutter Team')
      .setFramework('flutter', '3.24.3')
      .setSdkConstraints('>=3.22.0 <4.0.0')
      .setContentCategory('guide')
      .setLanguage('dart')
      .setRepo('flutter/samples', 5000)
      .setEmbedding('voyage', 'voyage-code-2', 1024)
      .setLastVerified(new Date('2024-01-01T00:00:00.000Z'))
      .addTags('authentication', 'security')
      .setNotes('Important reference')
      .build();

    expect(metadata.doc_type).toBe('official_doc');
    expect(metadata.source_quality).toBe('official');
    expect(metadata.framework).toBe('flutter');
    expect(metadata.framework_version).toBe('3.24.3');
    expect(metadata.sdk_constraints).toBe('>=3.22.0 <4.0.0');
    expect(metadata.embedding_provider).toBe('voyage');
    expect(metadata.embedding_model).toBe('voyage-code-2');
    expect(metadata.embedding_dimensions).toBe(1024);
    expect(metadata.tags).toEqual(['authentication', 'security']);
    expect(metadata.last_verified).toBe('2024-01-01T00:00:00.000Z');
  });

  it('auto-detects official source from flutter.dev URLs', () => {
    const metadata = buildMetadata().setSourceUrl('https://docs.flutter.dev').build();
    expect(metadata.source_quality).toBe('official');
  });

  it('auto-detects verified quality for popular repos', () => {
    const metadata = buildMetadata().setRepo('flutter/samples', 5000).build();
    expect(metadata.source_quality).toBe('verified');
  });

  it('infers language from file path when missing', () => {
    const metadata = buildMetadata().setFilePath('lib/src/app/example.dart').build();
    expect(metadata.language).toBe('dart');
  });

  it('sets sensible defaults when no information provided', () => {
    const metadata = new MetadataBuilder().build();
    expect(metadata.doc_type).toBe('tutorial');
    expect(metadata.source_quality).toBe('community');
    expect(metadata.embedding_model).toBe('nomic-embed-text');
    expect(metadata.embedding_provider).toBe('ollama');
    expect(metadata.embedding_dimensions).toBe(768);
  });

  it('supports fluent chaining without shared state', () => {
    const builderA = buildMetadata().setDocType('official_doc');
    const builderB = buildMetadata().setDocType('code_sample');

    expect(builderA.build().doc_type).toBe('official_doc');
    expect(builderB.build().doc_type).toBe('code_sample');
  });

  it('merges defaults with explicit metadata', () => {
    const defaults = { doc_type: 'tutorial', tags: ['existing'], source_quality: 'verified' };
    const metadata = buildMetadata().addTags('new').build(defaults);

    expect(metadata.doc_type).toBe('tutorial');
    expect(metadata.tags).toEqual(['existing', 'new']);
    expect(metadata.source_quality).toBe('verified');
  });
});
