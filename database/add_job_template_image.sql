-- Add image_url field to job_templates table
-- This allows a main image to be displayed on marketplace cards

ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN job_templates.image_url IS 'Main image URL for the job, displayed on marketplace cards';
