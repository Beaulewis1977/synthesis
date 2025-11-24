-- Migration: Feedback Loop and Quality Tracking
-- Tracks user feedback on search results and chat responses for quality improvement

-- Search result feedback
CREATE TABLE IF NOT EXISTS search_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was rated
  chunk_id INTEGER REFERENCES chunks(id) ON DELETE SET NULL,
  doc_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  
  -- Rating
  rating SMALLINT NOT NULL CHECK (rating BETWEEN -1 AND 1), -- -1 = thumbs down, 0 = neutral, 1 = thumbs up
  
  -- Context
  result_position INTEGER, -- Position in search results (1-indexed)
  similarity_score REAL,
  search_mode VARCHAR(20), -- vector, hybrid
  
  -- Optional feedback
  feedback_text TEXT,
  feedback_category VARCHAR(50), -- irrelevant, outdated, incorrect, helpful, perfect
  
  -- Session tracking
  session_id UUID,
  user_id UUID, -- For future multi-user support
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat response feedback
CREATE TABLE IF NOT EXISTS chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was rated
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  -- Rating
  rating SMALLINT NOT NULL CHECK (rating BETWEEN -1 AND 1),
  
  -- Detailed feedback
  feedback_categories JSONB DEFAULT '[]'::jsonb,
  -- Example: ["accurate", "helpful"] or ["hallucination", "incomplete"]
  feedback_text TEXT,
  
  -- Context
  query TEXT,
  sources_used INTEGER, -- Number of RAG sources used
  
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document quality scores (aggregated from feedback)
CREATE TABLE IF NOT EXISTS document_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Aggregated scores
  total_ratings INTEGER DEFAULT 0,
  positive_ratings INTEGER DEFAULT 0,
  negative_ratings INTEGER DEFAULT 0,
  quality_score REAL DEFAULT 0.5, -- 0.0 to 1.0, starts neutral
  
  -- Breakdown by context
  relevance_score REAL DEFAULT 0.5,
  accuracy_score REAL DEFAULT 0.5,
  freshness_score REAL DEFAULT 0.5,
  
  -- Usage stats
  times_retrieved INTEGER DEFAULT 0,
  times_cited INTEGER DEFAULT 0,
  
  last_feedback_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(doc_id)
);

-- Chunk quality scores
CREATE TABLE IF NOT EXISTS chunk_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  
  -- Aggregated scores
  total_ratings INTEGER DEFAULT 0,
  positive_ratings INTEGER DEFAULT 0,
  negative_ratings INTEGER DEFAULT 0,
  quality_score REAL DEFAULT 0.5,
  
  -- Usage
  times_retrieved INTEGER DEFAULT 0,
  avg_result_position REAL,
  
  last_feedback_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(chunk_id)
);

-- Quality metrics over time (for dashboards)
CREATE TABLE IF NOT EXISTS quality_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  -- Search metrics
  total_searches INTEGER DEFAULT 0,
  searches_with_feedback INTEGER DEFAULT 0,
  positive_search_feedback INTEGER DEFAULT 0,
  negative_search_feedback INTEGER DEFAULT 0,
  avg_result_quality REAL,
  
  -- Chat metrics
  total_messages INTEGER DEFAULT 0,
  messages_with_feedback INTEGER DEFAULT 0,
  positive_chat_feedback INTEGER DEFAULT 0,
  negative_chat_feedback INTEGER DEFAULT 0,
  
  -- Retrieval metrics
  avg_sources_per_query REAL,
  avg_similarity_score REAL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(collection_id, metric_date)
);

-- Function to update document quality score after feedback
CREATE OR REPLACE FUNCTION update_document_quality_score()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_quality_scores (doc_id, total_ratings, positive_ratings, negative_ratings, quality_score, last_feedback_at)
  VALUES (
    NEW.doc_id,
    1,
    CASE WHEN NEW.rating > 0 THEN 1 ELSE 0 END,
    CASE WHEN NEW.rating < 0 THEN 1 ELSE 0 END,
    CASE WHEN NEW.rating > 0 THEN 0.6 WHEN NEW.rating < 0 THEN 0.4 ELSE 0.5 END,
    NOW()
  )
  ON CONFLICT (doc_id) DO UPDATE SET
    total_ratings = document_quality_scores.total_ratings + 1,
    positive_ratings = document_quality_scores.positive_ratings + CASE WHEN NEW.rating > 0 THEN 1 ELSE 0 END,
    negative_ratings = document_quality_scores.negative_ratings + CASE WHEN NEW.rating < 0 THEN 1 ELSE 0 END,
    quality_score = (document_quality_scores.positive_ratings + CASE WHEN NEW.rating > 0 THEN 1 ELSE 0 END)::REAL / 
                    NULLIF(document_quality_scores.total_ratings + 1, 0),
    last_feedback_at = NOW(),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search feedback
CREATE TRIGGER trigger_update_doc_quality_on_search_feedback
AFTER INSERT ON search_feedback
FOR EACH ROW
WHEN (NEW.doc_id IS NOT NULL)
EXECUTE FUNCTION update_document_quality_score();

-- Indexes for efficient queries
CREATE INDEX idx_search_feedback_collection ON search_feedback(collection_id);
CREATE INDEX idx_search_feedback_doc ON search_feedback(doc_id);
CREATE INDEX idx_search_feedback_created ON search_feedback(created_at);
CREATE INDEX idx_chat_feedback_session ON chat_feedback(session_id);
CREATE INDEX idx_document_quality_score ON document_quality_scores(quality_score DESC);
CREATE INDEX idx_chunk_quality_score ON chunk_quality_scores(quality_score DESC);
CREATE INDEX idx_quality_metrics_date ON quality_metrics_daily(metric_date, collection_id);
