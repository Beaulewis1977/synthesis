import { describe, expect, it } from 'vitest';
import { MetadataBuilder, buildMetadata } from '../metadata-builder.js';

describe('MetadataBuilder', () => {
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
