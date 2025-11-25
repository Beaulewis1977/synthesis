-- Migration: Tech Stack Profiles for Collections
-- Allows collections to have associated tech stack configurations for smarter retrieval

-- Tech stack profile enum values
CREATE TYPE tech_stack_category AS ENUM (
  'frontend',
  'backend', 
  'database',
  'mobile',
  'devops',
  'testing',
  'other'
);

-- Collection tech stack profiles
CREATE TABLE IF NOT EXISTS collection_tech_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  
  -- Core tech stack
  primary_language VARCHAR(50), -- dart, typescript, python, kotlin, swift
  primary_framework VARCHAR(50), -- flutter, react, fastify, django, etc.
  
  -- Database stack
  database_type VARCHAR(50), -- postgres, supabase, firebase, mongodb
  database_version VARCHAR(20),
  
  -- Additional frameworks/libraries (JSON array)
  frameworks JSONB DEFAULT '[]'::jsonb,
  
  -- Search preferences
  prefer_official_docs BOOLEAN DEFAULT true,
  prefer_code_examples BOOLEAN DEFAULT true,
  min_source_quality VARCHAR(20) DEFAULT 'community', -- official, verified, community
  
  -- Version constraints for filtering
  version_constraints JSONB DEFAULT '{}'::jsonb,
  -- Example: {"flutter": ">=3.0.0", "dart": ">=3.0.0", "supabase": ">=2.0.0"}
  
  -- Embedding preferences
  code_embedding_provider VARCHAR(20) DEFAULT 'voyage',
  doc_embedding_provider VARCHAR(20) DEFAULT 'ollama',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(collection_id)
);

-- Predefined tech stack templates
CREATE TABLE IF NOT EXISTS tech_stack_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category tech_stack_category NOT NULL,
  
  -- Template configuration
  primary_language VARCHAR(50),
  primary_framework VARCHAR(50),
  database_type VARCHAR(50),
  frameworks JSONB DEFAULT '[]'::jsonb,
  version_constraints JSONB DEFAULT '{}'::jsonb,
  
  -- Search tuning
  search_boost_patterns JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"pattern": "Widget", "boost": 1.5}, {"pattern": "State", "boost": 1.3}]
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates for priority stacks
INSERT INTO tech_stack_templates (name, description, category, primary_language, primary_framework, database_type, frameworks, search_boost_patterns) VALUES
-- Flutter/Dart + Supabase (PRIMARY)
('flutter-supabase', 'Flutter mobile/web app with Supabase backend', 'mobile', 'dart', 'flutter', 'supabase', 
 '["supabase_flutter", "riverpod", "go_router", "freezed"]'::jsonb,
 '[{"pattern": "Widget", "boost": 1.5}, {"pattern": "State", "boost": 1.3}, {"pattern": "Provider", "boost": 1.2}, {"pattern": "Supabase", "boost": 1.4}]'::jsonb),

-- Flutter/Dart + Firebase
('flutter-firebase', 'Flutter app with Firebase backend', 'mobile', 'dart', 'flutter', 'firebase',
 '["firebase_core", "cloud_firestore", "firebase_auth", "riverpod"]'::jsonb,
 '[{"pattern": "Widget", "boost": 1.5}, {"pattern": "Firebase", "boost": 1.4}, {"pattern": "Firestore", "boost": 1.3}]'::jsonb),

-- Pure Dart
('dart-backend', 'Dart backend/CLI application', 'backend', 'dart', 'shelf', 'postgres',
 '["shelf", "postgres", "dio"]'::jsonb,
 '[{"pattern": "Handler", "boost": 1.3}, {"pattern": "Middleware", "boost": 1.2}]'::jsonb),

-- TypeScript + Fastify + Postgres
('typescript-fastify', 'TypeScript backend with Fastify and PostgreSQL', 'backend', 'typescript', 'fastify', 'postgres',
 '["fastify", "pg", "zod", "drizzle-orm"]'::jsonb,
 '[{"pattern": "Route", "boost": 1.3}, {"pattern": "Handler", "boost": 1.2}, {"pattern": "Schema", "boost": 1.2}]'::jsonb),

-- React + Supabase
('react-supabase', 'React web app with Supabase backend', 'frontend', 'typescript', 'react', 'supabase',
 '["@supabase/supabase-js", "react-query", "zustand", "tailwindcss"]'::jsonb,
 '[{"pattern": "Component", "boost": 1.4}, {"pattern": "Hook", "boost": 1.3}, {"pattern": "Supabase", "boost": 1.4}]'::jsonb),

-- Python + FastAPI + Postgres
('python-fastapi', 'Python backend with FastAPI and PostgreSQL', 'backend', 'python', 'fastapi', 'postgres',
 '["fastapi", "sqlalchemy", "pydantic", "alembic"]'::jsonb,
 '[{"pattern": "endpoint", "boost": 1.3}, {"pattern": "model", "boost": 1.2}, {"pattern": "schema", "boost": 1.2}]'::jsonb),

-- Kotlin Android
('kotlin-android', 'Kotlin Android application', 'mobile', 'kotlin', 'android', 'room',
 '["jetpack-compose", "hilt", "retrofit", "room"]'::jsonb,
 '[{"pattern": "Composable", "boost": 1.5}, {"pattern": "ViewModel", "boost": 1.3}, {"pattern": "Repository", "boost": 1.2}]'::jsonb),

-- Swift iOS
('swift-ios', 'Swift iOS application', 'mobile', 'swift', 'swiftui', 'coredata',
 '["swiftui", "combine", "coredata"]'::jsonb,
 '[{"pattern": "View", "boost": 1.5}, {"pattern": "ObservableObject", "boost": 1.3}, {"pattern": "Publisher", "boost": 1.2}]'::jsonb);

-- Index for fast lookups
CREATE INDEX idx_collection_tech_profiles_collection ON collection_tech_profiles(collection_id);
CREATE INDEX idx_tech_stack_templates_category ON tech_stack_templates(category);

-- Add tech_profile_id to collections for quick reference
ALTER TABLE collections ADD COLUMN IF NOT EXISTS tech_profile_id UUID REFERENCES collection_tech_profiles(id);
