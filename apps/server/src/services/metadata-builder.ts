const REPO_VERIFIED_STARS = 1000;

export interface DocumentMetadata {
  doc_type?: string;
  source_url?: string;
  source_quality?: 'official' | 'verified' | 'community';
  source_author?: string;
  framework?: string;
  framework_version?: string;
  sdk_constraints?: string;
  language?: string;
  content_category?: string;
  file_path?: string;
  repo_name?: string;
  repo_stars?: number;
  embedding_model?: string;
  embedding_provider?: string;
  embedding_dimensions?: number;
  last_verified?: string;
  published_date?: string;
  tags?: string[];
  notes?: string;
  [key: string]: unknown;
}

export class MetadataBuilder {
  private readonly metadata: DocumentMetadata = {};
  private _inferredSourceQuality?: DocumentMetadata['source_quality'];
  private _explicitSourceQuality?: DocumentMetadata['source_quality'];

  setDocType(type: string): this {
    this.metadata.doc_type = type;
    return this;
  }

  setSourceUrl(url: string): this {
    this.metadata.source_url = url;
    if (!this._inferredSourceQuality) {
      const inferred = inferSourceQuality(url);
      // Only cache non-community values to allow later upgrades
      if (inferred !== 'community') {
        this._inferredSourceQuality = inferred;
      }
    }
    return this;
  }

  setSourceQuality(quality: DocumentMetadata['source_quality']): this {
    this._explicitSourceQuality = quality;
    return this;
  }

  setFramework(framework: string, version?: string): this {
    this.metadata.framework = framework;
    if (version) {
      this.metadata.framework_version = version;
    }
    return this;
  }

  setLanguage(language: string): this {
    this.metadata.language = language;
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
        this._inferredSourceQuality !== 'verified'
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

    return {
      ...defaults,
      ...this.metadata,
      source_quality: finalSourceQuality,
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

  if (url.includes('flutter.dev') || url.includes('dart.dev')) {
    return 'official';
  }

  return 'community';
}

function inferLanguageFromPath(path: string): string | undefined {
  const lower = path.toLowerCase();

  if (lower.endsWith('.dart')) return 'dart';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.md')) return 'markdown';

  return undefined;
}
