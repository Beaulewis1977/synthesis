-- Add MMR default settings to collections table
ALTER TABLE collections
ADD COLUMN mmr_enabled BOOLEAN DEFAULT false,
ADD COLUMN mmr_lambda DECIMAL(3,2) DEFAULT 0.7
  CHECK (mmr_lambda >= 0.3 AND mmr_lambda <= 1.0);

-- Add comments for documentation
COMMENT ON COLUMN collections.mmr_enabled IS 'Default MMR enabled state for searches in this collection';
COMMENT ON COLUMN collections.mmr_lambda IS 'Default MMR lambda (diversity) value, range 0.3-1.0';
