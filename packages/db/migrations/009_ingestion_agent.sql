-- Ingestion Jobs: Track high-level agent tasks
CREATE TABLE ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', 
  -- Values: pending | processing | completed | failed
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error summary if failed
  error_summary TEXT
);

CREATE INDEX ingestion_jobs_collection_id_idx ON ingestion_jobs (collection_id);
CREATE INDEX ingestion_jobs_status_idx ON ingestion_jobs (status);
CREATE INDEX ingestion_jobs_created_at_idx ON ingestion_jobs (created_at DESC);


-- Ingestion Job URLs: Track individual URLs found and processed
CREATE TABLE ingestion_job_urls (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  -- Values: pending | scraped | ingested | failed | skipped
  
  -- Retry logic
  failure_count INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,
  
  -- Content tracking
  content_hash TEXT, -- To detect duplicates/changes
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  
  -- Notes/Error details
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ingestion_job_urls_job_id_idx ON ingestion_job_urls (job_id);
CREATE INDEX ingestion_job_urls_status_idx ON ingestion_job_urls (status);
CREATE UNIQUE INDEX ingestion_job_urls_job_url_idx ON ingestion_job_urls (job_id, url);

