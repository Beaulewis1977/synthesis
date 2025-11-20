-- Create default collections for testing
INSERT INTO collections (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Getting Started', 'Tutorial and setup documentation'),
  ('00000000-0000-0000-0000-000000000002', 'Flutter & Dart', 'Mobile development documentation'),
  ('00000000-0000-0000-0000-000000000003', 'Supabase Stack', 'Backend and database documentation')
ON CONFLICT DO NOTHING;
