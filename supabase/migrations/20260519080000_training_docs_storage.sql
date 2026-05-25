-- Storage bucket for training documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-docs', 'training-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read training docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'training-docs');

CREATE POLICY "Users upload own training docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'training-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own training docs" ON storage.objects
  FOR UPDATE USING (bucket_id = 'training-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own training docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'training-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
