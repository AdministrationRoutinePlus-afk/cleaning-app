-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 8: Storage Buckets
-- =============================================

-- Create storage buckets
-- Note: Run these in Supabase SQL Editor

-- 1. JOB IMAGES (Public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-images', 'job-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. EMPLOYEE DOCUMENTS (Private - only owner and employer can access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for job-images bucket
CREATE POLICY "Public read access for job images"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-images');

CREATE POLICY "Authenticated users can upload job images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own job images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'job-images'
  AND auth.uid() = owner
);

CREATE POLICY "Users can delete their own job images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-images'
  AND auth.uid() = owner
);

-- Storage Policies for employee-documents bucket
CREATE POLICY "Employees can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents'
  AND auth.uid() = owner
);

CREATE POLICY "Employees can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Employees can update their own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-documents'
  AND auth.uid() = owner
);

CREATE POLICY "Employees can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-documents'
  AND auth.uid() = owner
);
