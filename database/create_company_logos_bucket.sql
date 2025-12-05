-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Employers can upload their logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos'
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view logos (public)
CREATE POLICY "Logos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Allow employers to update/delete their own logos
CREATE POLICY "Employers can update their logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Employers can delete their logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND auth.role() = 'authenticated'
);
