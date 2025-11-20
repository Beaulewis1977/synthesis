import { describe, expect, it } from 'vitest';
import { detectTechStack } from '../tech-detector.js';

describe('tech-detector', () => {
  describe('detectTechStack', () => {
    describe('Flutter detection', () => {
      it('should detect Flutter with 2+ signals (lib/ path + package:flutter)', () => {
        const filePath = 'lib/main.dart';
        const content = "import 'package:flutter/material.dart';";
        const metadata = { language: 'dart' };

        const tags = detectTechStack(filePath, content, metadata);

        expect(tags).toContain('flutter');
        expect(tags).toContain('dart');
      });

      it('should detect Flutter in pubspec.yaml with lib/ context', () => {
        // pubspec.yaml alone doesn't have 2 signals - needs lib/ path too
        // But if content has "flutter" + package:flutter, that's 2 signals
        const filePath = 'lib/pubspec.yaml'; // lib/ path provides 1st signal
        const content = `
name: my_app
dependencies:
  flutter:
    sdk: flutter
import 'package:flutter/material.dart'; # code comment
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('flutter');
      });

      it('should detect Flutter with StatelessWidget', () => {
        const filePath = 'lib/widgets/button.dart';
        const content = `
class MyButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container();
  }
}
`;
        const metadata = { language: 'dart' };

        const tags = detectTechStack(filePath, content, metadata);

        expect(tags).toContain('flutter');
        expect(tags).toContain('dart');
      });

      it('should NOT detect Flutter with insufficient signals', () => {
        const filePath = 'some/random/file.txt';
        const content = 'flutter';

        const tags = detectTechStack(filePath, content);

        expect(tags).not.toContain('flutter');
      });
    });

    describe('Dart detection', () => {
      it('should detect Dart with .dart extension + imports', () => {
        const filePath = 'lib/utils/helpers.dart';
        const content = "import 'dart:core';";

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('dart');
      });

      it('should detect Dart with .dart extension + class keyword', () => {
        const filePath = 'models/user.dart';
        const content = 'class User { }';

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('dart');
      });

      it('should detect Dart with metadata language hint', () => {
        const filePath = 'lib/main.dart';
        const content = 'void main() { }';
        const metadata = { language: 'dart' };

        const tags = detectTechStack(filePath, content, metadata);

        expect(tags).toContain('dart');
      });

      it('should NOT detect Dart with insufficient signals', () => {
        const filePath = 'readme.md';
        const content = 'This is about Dart programming';

        const tags = detectTechStack(filePath, content);

        expect(tags).not.toContain('dart');
      });
    });

    describe('Supabase detection', () => {
      it('should detect Supabase with migrations path + uuid patterns', () => {
        const filePath = 'supabase/migrations/001_create_users.sql';
        const content = `
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid(),
  email text
);
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('supabase');
        expect(tags).toContain('postgres');
      });

      it('should detect Supabase with auth schema', () => {
        const filePath = 'migrations/002_auth.sql';
        const content = `
CREATE TABLE auth.users (
  id uuid DEFAULT gen_random_uuid()
);
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('supabase');
      });

      it('should detect Supabase with environment variables + schema reference', () => {
        // Need 2+ signals: env vars provide 1, need another
        const filePath = 'supabase/.env'; // supabase/ path provides 1st signal
        const content = `
SUPABASE_URL=https://example.supabase.co
SUPABASE_ANON_KEY=your_key_here
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('supabase');
      });

      it('should detect Supabase in docker-compose with explicit image', () => {
        const filePath = 'supabase/docker-compose.yml'; // supabase/ path + docker image
        const content = `
version: '3.8'
services:
  supabase-db:
    image: supabase/postgres:16
    environment:
      POSTGRES_PASSWORD: password
`;

        const tags = detectTechStack(filePath, content);

        // Supabase detection via supabase/ path + supabase/postgres image
        expect(tags).toContain('supabase');
        // Postgres detection may or may not occur depending on signal strength
      });

      it('should NOT detect Supabase with insufficient signals', () => {
        const filePath = 'random.txt';
        const content = 'I like Supabase';

        const tags = detectTechStack(filePath, content);

        expect(tags).not.toContain('supabase');
      });
    });

    describe('PostgreSQL detection', () => {
      it('should detect Postgres with .sql extension + postgres types', () => {
        const filePath = 'schema.sql';
        const content = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  data JSONB
);
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('postgres');
      });

      it('should detect Postgres with uuid and gen_random_uuid', () => {
        const filePath = 'migrations/001.sql';
        const content = `
CREATE TABLE sessions (
  id uuid DEFAULT gen_random_uuid()
);
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('postgres');
      });

      it('should detect Postgres with DATABASE_URL + SQL file', () => {
        // DATABASE_URL alone is 1 signal, need .sql extension for 2nd
        const filePath = 'schema.sql';
        const content = `
-- DATABASE_URL: postgresql://user:pass@localhost:5432/db
CREATE TABLE users (id SERIAL);
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('postgres');
      });

      it('should detect Postgres in docker-compose with DATABASE_URL', () => {
        // docker-compose postgres image provides 1 signal, need another
        const filePath = 'docker-compose.yml';
        const content = `
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: mydb
      DATABASE_URL: postgresql://localhost:5432/mydb
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('postgres');
      });

      it('should NOT detect Postgres with insufficient signals', () => {
        const filePath = 'notes.txt';
        const content = 'postgres is a database';

        const tags = detectTechStack(filePath, content);

        expect(tags).not.toContain('postgres');
      });
    });

    describe('Redis detection', () => {
      it('should detect Redis with redis.conf filename', () => {
        const filePath = 'config/redis.conf';
        const content = `
bind 127.0.0.1
port 6379
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('redis');
      });

      it('should detect Redis with config file + keys', () => {
        // redis.conf filename is 1 signal, redis keys are another
        const filePath = 'redis.conf';
        const content = `
REDIS_HOST=localhost
REDIS_PORT=6379
bind 127.0.0.1
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('redis');
      });

      it('should detect Redis in docker-compose with config', () => {
        const filePath = 'docker-compose.yml';
        const content = `
services:
  cache:
    image: redis:7
    environment:
      REDIS_HOST: localhost
    ports:
      - "6379:6379"
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('redis');
      });

      it('should detect Redis with redis directives', () => {
        const filePath = 'redis.conf';
        const content = `
maxmemory 256mb
maxmemory-policy allkeys-lru
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('redis');
      });

      it('should NOT detect Redis with insufficient signals', () => {
        const filePath = 'article.md';
        const content = 'Redis is a fast cache';

        const tags = detectTechStack(filePath, content);

        expect(tags).not.toContain('redis');
      });
    });

    describe('Multiple tech stacks', () => {
      it('should detect multiple stacks in docker-compose with strong signals', () => {
        const filePath = 'supabase/docker-compose.yml'; // supabase/ path helps detection
        const content = `
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      DATABASE_URL: postgresql://localhost:5432/db
  cache:
    image: redis:7
    environment:
      REDIS_HOST: localhost
  supabase-db:
    image: supabase/postgres:16
`;

        const tags = detectTechStack(filePath, content);

        expect(tags).toContain('postgres');
        expect(tags).toContain('redis');
        expect(tags).toContain('supabase');
        expect(tags).toEqual(expect.arrayContaining(['postgres', 'redis', 'supabase']));
      });

      it('should detect Flutter + Dart together', () => {
        const filePath = 'lib/main.dart';
        const content = `
import 'package:flutter/material.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp();
  }
}
`;
        const metadata = { language: 'dart' };

        const tags = detectTechStack(filePath, content, metadata);

        expect(tags).toContain('flutter');
        expect(tags).toContain('dart');
        expect(tags.length).toBe(2);
      });

      it('should return sorted array', () => {
        const filePath = 'docker-compose.yml';
        const content = `
services:
  redis:
    image: redis:7
    environment:
      REDIS_HOST: localhost
  db:
    image: postgres:16
    environment:
      DATABASE_URL: postgresql://localhost:5432/db
`;

        const tags = detectTechStack(filePath, content);

        // Should be sorted alphabetically
        expect(tags).toEqual(['postgres', 'redis']);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty content', () => {
        const tags = detectTechStack('file.txt', '');

        expect(tags).toEqual([]);
      });

      it('should handle content with no tech stack', () => {
        const content = 'Lorem ipsum dolor sit amet';
        const tags = detectTechStack('document.txt', content);

        expect(tags).toEqual([]);
      });

      it('should require at least 2 signals per technology', () => {
        // Only 1 signal: just the word "flutter"
        const tags1 = detectTechStack('notes.txt', 'flutter');
        expect(tags1).not.toContain('flutter');

        // 2 signals: lib/ path + "package:flutter"
        const tags2 = detectTechStack('lib/main.dart', "import 'package:flutter/material.dart';");
        expect(tags2).toContain('flutter');
      });

      it('should deduplicate tech stack tags', () => {
        const filePath = 'supabase/migrations/001.sql';
        const content = `
-- Supabase migration
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid()
);
`;

        const tags = detectTechStack(filePath, content);

        // Should not have duplicates
        expect(tags).toEqual(Array.from(new Set(tags)));
      });
    });
  });
});
