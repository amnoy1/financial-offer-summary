-- ========================================
-- Migration 002: Storage Buckets
-- ========================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('recordings', 'recordings', false),
  ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for recordings bucket
CREATE POLICY "auth users can upload recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'recordings' AND auth.role() = 'authenticated');

CREATE POLICY "auth users can read recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recordings' AND auth.role() = 'authenticated');

CREATE POLICY "auth users can delete recordings"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'recordings' AND auth.role() = 'authenticated');

-- RLS for pdfs bucket
CREATE POLICY "auth users can manage pdfs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'pdfs' AND auth.role() = 'authenticated');
