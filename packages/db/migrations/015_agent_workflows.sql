-- Migration: Agent Workflow Tools (Task-Oriented Retrieval)
-- Supports structured agent workflows with task tracking and specialized retrieval

-- Workflow definitions (templates for common tasks)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Workflow type
  category VARCHAR(50) NOT NULL, -- code_review, bug_fix, feature_impl, refactor, docs, learning
  
  -- Tech stack affinity
  tech_stacks JSONB DEFAULT '[]'::jsonb, -- ["flutter", "typescript", "python"]
  
  -- Steps definition
  steps JSONB NOT NULL,
  -- Example: [
  --   {"id": "understand", "name": "Understand Context", "tools": ["search_rag"], "prompt_template": "..."},
  --   {"id": "find_examples", "name": "Find Examples", "tools": ["search_rag"], "filters": {"chunk_type": "code"}},
  --   {"id": "synthesize", "name": "Synthesize Solution", "tools": ["synthesize"]}
  -- ]
  
  -- Default settings
  default_collection_filter JSONB DEFAULT '{}'::jsonb,
  
  is_system BOOLEAN DEFAULT false, -- System templates vs user-created
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active workflow instances
CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id),
  
  -- Context
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES chat_sessions(id),
  
  -- Task description
  task_description TEXT NOT NULL,
  task_context JSONB DEFAULT '{}'::jsonb,
  -- Example: {"file_path": "lib/main.dart", "error_message": "...", "goal": "fix null safety"}
  
  -- Progress
  status VARCHAR(20) DEFAULT 'active', -- active, paused, completed, failed
  current_step_id VARCHAR(50),
  completed_steps JSONB DEFAULT '[]'::jsonb,
  
  -- Results
  findings JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"step": "understand", "sources": [...], "summary": "..."}]
  
  final_output TEXT,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task-specific retrieval queries (saved searches for workflows)
CREATE TABLE IF NOT EXISTS task_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_id VARCHAR(50),
  
  -- Query details
  query TEXT NOT NULL,
  query_type VARCHAR(30) DEFAULT 'semantic', -- semantic, keyword, hybrid, code_search
  
  -- Filters applied
  filters JSONB DEFAULT '{}'::jsonb,
  -- Example: {"language": "dart", "chunk_type": "code", "min_quality": 0.6}
  
  -- Results
  result_count INTEGER,
  top_results JSONB DEFAULT '[]'::jsonb, -- Store top N result IDs and scores
  
  -- Feedback
  was_helpful BOOLEAN,
  
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Code context tracking (for code-aware retrieval)
CREATE TABLE IF NOT EXISTS code_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  
  -- File being worked on
  file_path TEXT NOT NULL,
  file_language VARCHAR(50),
  
  -- Current code context
  current_code TEXT,
  code_hash VARCHAR(64), -- For change detection
  
  -- Extracted context
  imports JSONB DEFAULT '[]'::jsonb,
  classes JSONB DEFAULT '[]'::jsonb,
  functions JSONB DEFAULT '[]'::jsonb,
  dependencies JSONB DEFAULT '[]'::jsonb,
  
  -- Related files from codebase
  related_files JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default workflow templates
INSERT INTO workflow_templates (name, description, category, tech_stacks, steps, is_system) VALUES
-- Bug Fix Workflow
('bug-fix', 'Systematic bug investigation and fix', 'bug_fix', '[]'::jsonb,
 '[
   {"id": "understand_error", "name": "Understand Error", "description": "Search for similar errors and their solutions", "tools": ["search_rag"], "query_template": "error: {error_message} {language}"},
   {"id": "find_context", "name": "Find Related Code", "description": "Find related code patterns and implementations", "tools": ["search_rag"], "filters": {"chunk_type": "code"}},
   {"id": "check_docs", "name": "Check Documentation", "description": "Review official documentation for the relevant APIs", "tools": ["search_rag"], "filters": {"source_quality": "official"}},
   {"id": "synthesize", "name": "Synthesize Fix", "description": "Combine findings into a solution", "tools": ["synthesize"]}
 ]'::jsonb, true),

-- Feature Implementation Workflow
('feature-impl', 'Implement a new feature with best practices', 'feature_impl', '[]'::jsonb,
 '[
   {"id": "research", "name": "Research Patterns", "description": "Find similar implementations and patterns", "tools": ["search_rag"]},
   {"id": "find_examples", "name": "Find Examples", "description": "Find code examples for the feature", "tools": ["search_rag"], "filters": {"chunk_type": "code", "is_example": true}},
   {"id": "check_api", "name": "Check API Docs", "description": "Review API documentation", "tools": ["search_rag"], "filters": {"source_quality": "official"}},
   {"id": "plan", "name": "Create Plan", "description": "Synthesize implementation plan", "tools": ["synthesize"]}
 ]'::jsonb, true),

-- Flutter Widget Workflow
('flutter-widget', 'Create or modify Flutter widgets', 'feature_impl', '["flutter", "dart"]'::jsonb,
 '[
   {"id": "find_similar", "name": "Find Similar Widgets", "description": "Search for similar widget implementations", "tools": ["search_rag"], "filters": {"is_widget": true}},
   {"id": "check_patterns", "name": "Check State Patterns", "description": "Find state management patterns", "tools": ["search_rag"], "query_template": "{task} state management flutter"},
   {"id": "find_styling", "name": "Find Styling Examples", "description": "Find relevant styling and theming", "tools": ["search_rag"], "query_template": "flutter theme style {task}"},
   {"id": "synthesize", "name": "Synthesize Widget", "description": "Create widget implementation plan", "tools": ["synthesize"]}
 ]'::jsonb, true),

-- Supabase Integration Workflow  
('supabase-integration', 'Integrate Supabase features', 'feature_impl', '["supabase", "postgres"]'::jsonb,
 '[
   {"id": "find_schema", "name": "Find Schema Patterns", "description": "Search for database schema patterns", "tools": ["search_rag"], "filters": {"sql_type": "table"}},
   {"id": "find_rls", "name": "Find RLS Examples", "description": "Find Row Level Security examples", "tools": ["search_rag"], "query_template": "supabase RLS policy {task}"},
   {"id": "find_client", "name": "Find Client Usage", "description": "Find Supabase client code examples", "tools": ["search_rag"], "query_template": "supabase client {language} {task}"},
   {"id": "synthesize", "name": "Synthesize Integration", "description": "Create integration plan", "tools": ["synthesize"]}
 ]'::jsonb, true),

-- Code Review Workflow
('code-review', 'Review code for issues and improvements', 'code_review', '[]'::jsonb,
 '[
   {"id": "find_patterns", "name": "Find Best Practices", "description": "Search for best practices for this code pattern", "tools": ["search_rag"]},
   {"id": "check_security", "name": "Check Security", "description": "Find security considerations", "tools": ["search_rag"], "query_template": "security {language} {pattern}"},
   {"id": "find_tests", "name": "Find Test Patterns", "description": "Find testing patterns for this code", "tools": ["search_rag"], "query_template": "test {language} {pattern}"},
   {"id": "synthesize", "name": "Synthesize Review", "description": "Create review summary", "tools": ["synthesize"]}
 ]'::jsonb, true),

-- Learning Workflow
('learn-concept', 'Learn a new concept or technology', 'learning', '[]'::jsonb,
 '[
   {"id": "overview", "name": "Get Overview", "description": "Find overview and introduction", "tools": ["search_rag"], "filters": {"content_category": "guide"}},
   {"id": "examples", "name": "Find Examples", "description": "Find practical examples", "tools": ["search_rag"], "filters": {"chunk_type": "code", "is_example": true}},
   {"id": "advanced", "name": "Find Advanced Topics", "description": "Find advanced usage and edge cases", "tools": ["search_rag"]},
   {"id": "synthesize", "name": "Synthesize Learning", "description": "Create learning summary", "tools": ["synthesize"]}
 ]'::jsonb, true);

-- Indexes
CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_tech ON workflow_templates USING GIN(tech_stacks);
CREATE INDEX idx_workflow_instances_collection ON workflow_instances(collection_id);
CREATE INDEX idx_workflow_instances_user ON workflow_instances(user_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_task_queries_workflow ON task_queries(workflow_instance_id);
CREATE INDEX idx_code_contexts_workflow ON code_contexts(workflow_instance_id);
