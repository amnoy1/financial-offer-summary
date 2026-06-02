-- ========================================
-- Migration 003: Logos Storage Bucket
-- ========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (logos are displayed publicly in the app header)
CREATE POLICY "logos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- Only authenticated users can upload logos
CREATE POLICY "auth users can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "auth users can update logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
