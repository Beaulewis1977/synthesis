import type { DocumentMetadata } from '@synthesis/shared';

const REPO_VERIFIED_STARS = 1000;

export class MetadataBuilder {
  private readonly metadata: DocumentMetadata = {};
  private _inferredSourceQuality?: DocumentMetadata['source_quality'];
  private _explicitSourceQuality?: DocumentMetadata['source_quality'];

  setDocType(type: NonNullable<DocumentMetadata['doc_type']>): this {
    this.metadata.doc_type = type;
    return this;
  }

  setSourceUrl(url: string): this {
    this.metadata.source_url = url;
    if (!this._inferredSourceQuality) {
      this._inferredSourceQuality = inferSourceQuality(url);
    }
    return this;
  }

  setSourceAuthor(author: string): this {
    this.metadata.source_author = author;
    return this;
  }

  setSourceQuality(quality: DocumentMetadata['source_quality']): this {
    this._explicitSourceQuality = quality;
    return this;
  }

  setFramework(framework: DocumentMetadata['framework'], version?: string): this {
    this.metadata.framework = framework;
    if (version) {
      this.metadata.framework_version = version;
    }
    return this;
  }

  setSdkConstraints(constraints: string): this {
    this.metadata.sdk_constraints = constraints;
    return this;
  }

  setCompatibilityTested(values: string[]): this {
    this.metadata.compatibility_tested = [...values];
    return this;
  }

  setLanguage(language: DocumentMetadata['language']): this {
    this.metadata.language = language;
    return this;
  }

  setContentCategory(category: DocumentMetadata['content_category']): this {
    this.metadata.content_category = category;
    return this;
  }

  setFilePath(path: string): this {
    this.metadata.file_path = path;
    if (!this.metadata.language) {
      this.metadata.language = inferLanguageFromPath(path);
    }
    return this;
  }

  setRepo(name: string, stars?: number): this {
    this.metadata.repo_name = name;
    if (typeof stars === 'number') {
      this.metadata.repo_stars = stars;
      // Upgrade to 'verified' if stars threshold met and not already official/verified
      if (
        stars >= REPO_VERIFIED_STARS &&
        this._inferredSourceQuality !== 'official' &&
        this._explicitSourceQuality !== 'official'
      ) {
        this._inferredSourceQuality = 'verified';
      }
    }
    return this;
  }

  setEmbedding(provider: string, model: string, dimensions: number): this {
    this.metadata.embedding_provider = provider;
    this.metadata.embedding_model = model;
    this.metadata.embedding_dimensions = dimensions;
    return this;
  }

  setLastVerified(date: Date = new Date()): this {
    this.metadata.last_verified = date.toISOString();
    return this;
  }

  setPublishedDate(date: Date): this {
    this.metadata.published_date = date.toISOString();
    return this;
  }

  addTags(...tags: string[]): this {
    const existing = this.metadata.tags ?? [];
    this.metadata.tags = [...existing, ...tags];
    return this;
  }

  setNotes(notes: string): this {
    this.metadata.notes = notes;
    return this;
  }

  build(defaults: Partial<DocumentMetadata> = {}): DocumentMetadata {
    // Resolve final source_quality: explicit > inferred > caller's default > fallback
    const finalSourceQuality =
      this._explicitSourceQuality ??
      this._inferredSourceQuality ??
      defaults.source_quality ??
      'community';

    const embeddingModel =
      this.metadata.embedding_model ?? defaults.embedding_model ?? 'nomic-embed-text';
    const embeddingProvider =
      this.metadata.embedding_provider ?? defaults.embedding_provider ?? 'ollama';
    const embeddingDimensions =
      this.metadata.embedding_dimensions ?? defaults.embedding_dimensions ?? 768;

    const defaultTags = Array.isArray(defaults.tags) ? defaults.tags : [];
    const explicitTags = Array.isArray(this.metadata.tags) ? this.metadata.tags : [];
    const mergedTags =
      defaultTags.length || explicitTags.length ? [...defaultTags, ...explicitTags] : undefined;

    const combined = {
      ...defaults,
      ...this.metadata,
    };

    return {
      ...combined,
      source_quality: finalSourceQuality,
      embedding_model: embeddingModel,
      embedding_provider: embeddingProvider,
      embedding_dimensions: embeddingDimensions,
      doc_type: this.metadata.doc_type ?? defaults.doc_type ?? 'tutorial',
      ...(mergedTags ? { tags: mergedTags } : {}),
    };
  }
}

export function buildMetadata(): MetadataBuilder {
  return new MetadataBuilder();
}

function inferSourceQuality(url: string): DocumentMetadata['source_quality'] {
  if (!url) {
    return 'community';
  }

  const lower = url.toLowerCase();
  if (lower.includes('flutter.dev') || lower.includes('dart.dev')) {
    return 'official';
  }

  if (lower.includes('github.com')) {
    return 'verified';
  }

  return 'community';
}

function inferLanguageFromPath(path: string): DocumentMetadata['language'] | undefined {
  const lower = path.toLowerCase();

  if (lower.endsWith('.dart')) return 'dart';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.md')) return 'markdown';

  return undefined;
}
