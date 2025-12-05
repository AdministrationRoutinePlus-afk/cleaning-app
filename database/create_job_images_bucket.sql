-- Create storage bucket for job images
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-images', 'job-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Authenticated users can upload job images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update job images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to job images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete job images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload job images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-images');

-- Allow authenticated users to update their images
CREATE POLICY "Authenticated users can update job images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'job-images');

-- Allow public read access to job images
CREATE POLICY "Public read access to job images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-images');

-- Allow authenticated users to delete their images
CREATE POLICY "Authenticated users can delete job images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'job-images');
