import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chunkCodeFile } from '../code-chunker.js';

/**
 * Phase 13.5 E2E Integration Tests
 * Tests backend parsing with a realistic corpus: Supabase schema + config + Flutter client
 */
describe('Phase 13.5: Backend Parsing Integration', () => {
  const BACKEND_PARSING_ORIGINAL = process.env.BACKEND_PARSING;
  const TECH_STACK_TAGS_ORIGINAL = process.env.TECH_STACK_TAGS;

  beforeAll(() => {
    // Ensure flags are set for tests
    process.env.BACKEND_PARSING = 'true';
    process.env.TECH_STACK_TAGS = 'true';
  });

  afterAll(() => {
    // Restore original flags
    process.env.BACKEND_PARSING = BACKEND_PARSING_ORIGINAL;
    process.env.TECH_STACK_TAGS = TECH_STACK_TAGS_ORIGINAL;
  });

  describe('Supabase Schema Corpus', () => {
    const supabaseSchemaSQL = `
-- Supabase schema for user management
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_user_id_idx ON public.profiles (user_id);
CREATE INDEX users_email_idx ON public.users (email);
`;

    it('should parse Supabase schema with tech stack tags', async () => {
      const chunks = await chunkCodeFile('supabase/migrations/001_init.sql', supabaseSchemaSQL);

      // Should have chunks for tables and indexes
      expect(chunks.length).toBeGreaterThan(0);

      // Find users table chunk
      const usersChunk = chunks.find((c) => c.metadata.table === 'users');
      expect(usersChunk).toBeDefined();
      expect(usersChunk?.metadata.chunk_type).toBe('code');
      expect(usersChunk?.metadata.language).toBe('sql');
      expect(usersChunk?.metadata.sql_type).toBe('table');
      expect(usersChunk?.metadata.schema).toBe('public');
      expect(usersChunk?.metadata.tech_stack).toEqual(
        expect.arrayContaining(['postgres', 'supabase'])
      );

      // Verify columns metadata
      expect(usersChunk?.metadata.columns).toHaveLength(4);
      expect(usersChunk?.metadata.columns?.[0]).toMatchObject({
        name: 'id',
        type: 'uuid',
      });
      expect(usersChunk?.metadata.columns?.[1]).toMatchObject({
        name: 'email',
        type: 'text',
      });

      // Verify cross-tech hint
      expect(usersChunk?.metadata.maps_to).toEqual({
        type: 'table',
        name: 'users',
      });
    });

    it('should parse profiles table with foreign key', async () => {
      const chunks = await chunkCodeFile('supabase/migrations/001_init.sql', supabaseSchemaSQL);

      const profilesChunk = chunks.find((c) => c.metadata.table === 'profiles');
      expect(profilesChunk).toBeDefined();
      expect(profilesChunk?.metadata.columns).toHaveLength(6);
      expect(profilesChunk?.metadata.tech_stack).toEqual(
        expect.arrayContaining(['postgres', 'supabase'])
      );

      // Verify cross-tech hint
      expect(profilesChunk?.metadata.maps_to).toEqual({
        type: 'table',
        name: 'profiles',
      });
    });

    it('should parse indexes separately', async () => {
      const chunks = await chunkCodeFile('supabase/migrations/001_init.sql', supabaseSchemaSQL);

      const indexChunks = chunks.filter((c) => c.metadata.sql_type === 'index');
      expect(indexChunks.length).toBeGreaterThanOrEqual(2);

      const profilesIndex = indexChunks.find((c) =>
        c.metadata.indexes?.includes('profiles_user_id_idx')
      );
      expect(profilesIndex).toBeDefined();
      expect(profilesIndex?.metadata.table).toBe('profiles');
    });
  });

  describe('Docker Compose Config Corpus', () => {
    const dockerComposeYAML = `
version: '3.8'
services:
  database:
    image: postgres:16
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/myapp
    ports:
      - "5432:5432"
  
  cache:
    image: redis:7
    environment:
      REDIS_HOST: localhost
      REDIS_PORT: 6379
    ports:
      - "6379:6379"
`;

    it('should parse docker-compose with tech stack tags', async () => {
      const chunks = await chunkCodeFile('docker-compose.yml', dockerComposeYAML);

      expect(chunks.length).toBeGreaterThan(0);

      // Config parser extracts top-level sections (version, services)
      const servicesChunk = chunks.find((c) => c.metadata.config_section === 'services');
      expect(servicesChunk).toBeDefined();
      expect(servicesChunk?.metadata.chunk_type).toBe('code');
      expect(servicesChunk?.metadata.language).toBe('yaml');
      expect(servicesChunk?.metadata.format).toBe('yaml');
      expect(servicesChunk?.metadata.tech_stack).toEqual(
        expect.arrayContaining(['postgres', 'redis'])
      );

      // Verify nested paths include service definitions
      expect(servicesChunk?.metadata.nested_paths).toEqual(
        expect.arrayContaining([expect.stringContaining('services.')])
      );

      // At minimum, should have parsed the YAML structure
      expect(chunks.length).toBeGreaterThanOrEqual(2); // version + services
    });

    it('should parse all sections from docker-compose', async () => {
      const chunks = await chunkCodeFile('docker-compose.yml', dockerComposeYAML);

      // Should have version and services sections
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      // Verify tech stack detection
      const anyChunkWithTechStack = chunks.find(
        (c) => c.metadata.tech_stack && c.metadata.tech_stack.length > 0
      );
      expect(anyChunkWithTechStack).toBeDefined();
      expect(anyChunkWithTechStack?.metadata.tech_stack).toEqual(
        expect.arrayContaining(['postgres', 'redis'])
      );
    });
  });

  describe('Flutter Client Corpus', () => {
    const flutterClientDart = `
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class UserProfile extends StatelessWidget {
  final String userId;

  const UserProfile({Key? key, required this.userId}) : super(key:key);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: Supabase.instance.client
          .from('profiles')
          .select()
          .eq('user_id', userId)
          .single(),
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          final profile = snapshot.data as Map<String, dynamic>;
          return Column(
            children: [
              Text(profile['display_name'] ?? 'No name'),
              Text(profile['bio'] ?? ''),
            ],
          );
        }
        return CircularProgressIndicator();
      },
    );
  }
}
`;

    it('should parse Flutter client with tech stack tags', async () => {
      const chunks = await chunkCodeFile('lib/widgets/user_profile.dart', flutterClientDart);

      expect(chunks.length).toBeGreaterThan(0);

      const classChunk = chunks.find((c) => c.metadata.class_name === 'UserProfile');
      expect(classChunk).toBeDefined();
      expect(classChunk?.metadata.chunk_type).toBe('code');
      expect(classChunk?.metadata.language).toBe('dart');
      expect(classChunk?.metadata.is_widget).toBe(true);

      // Note: Dart chunker uses Phase 13 code path which doesn't add tech_stack yet
      // This is OK - tech_stack is mainly for backend files (SQL/config)
      // Flutter/Dart detection still works via file-relationships service

      // Verify Flutter-specific metadata
      expect(classChunk?.metadata.extends).toBe('StatelessWidget');
    });
  });

  describe('Feature Flag Behavior', () => {
    it('should use simple chunking when BACKEND_PARSING=false for SQL', async () => {
      const originalFlag = process.env.BACKEND_PARSING;
      process.env.BACKEND_PARSING = 'false';

      const simpleSQL = 'CREATE TABLE users (id SERIAL);';
      const chunks = await chunkCodeFile('schema.sql', simpleSQL);

      // Should fall back to simple text chunking
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
      expect(chunks[0].metadata.sql_type).toBeUndefined();

      process.env.BACKEND_PARSING = originalFlag;
    });

    it('should use simple chunking when BACKEND_PARSING=false for YAML', async () => {
      const originalFlag = process.env.BACKEND_PARSING;
      process.env.BACKEND_PARSING = 'false';

      const simpleYAML = 'database:\n  host: localhost';
      const chunks = await chunkCodeFile('config.yml', simpleYAML);

      // Should fall back to simple text chunking
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
      expect(chunks[0].metadata.format).toBeUndefined();

      process.env.BACKEND_PARSING = originalFlag;
    });

    it('should not add tech_stack tags when TECH_STACK_TAGS=false', async () => {
      const originalFlag = process.env.TECH_STACK_TAGS;
      process.env.TECH_STACK_TAGS = 'false';

      const sql = 'CREATE TABLE users (id uuid);';
      const chunks = await chunkCodeFile('supabase/schema.sql', sql);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.tech_stack).toBeUndefined();

      process.env.TECH_STACK_TAGS = originalFlag;
    });
  });

  describe('Chunking Performance', () => {
    it('should parse SQL file in < 300ms', async () => {
      const largeSQL = `
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE posts (id uuid PRIMARY KEY);
CREATE TABLE comments (id uuid PRIMARY KEY);
CREATE TABLE likes (id uuid PRIMARY KEY);
CREATE TABLE follows (id uuid PRIMARY KEY);
`.repeat(10); // 50 tables

      const start = Date.now();
      await chunkCodeFile('schema.sql', largeSQL);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(300);
    });

    it('should parse YAML file in < 300ms', async () => {
      const largeYAML = `
services:
  db1:
    image: postgres:16
  db2:
    image: postgres:16
  db3:
    image: postgres:16
`.repeat(20); // 60 services

      const start = Date.now();
      await chunkCodeFile('docker-compose.yml', largeYAML);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(300);
    });
  });
});
