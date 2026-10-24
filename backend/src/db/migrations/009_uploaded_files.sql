-- 009_uploaded_files.sql: Persistent store for uploaded promotional banners, flyers, and circulars
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id text PRIMARY KEY,
  folder text NOT NULL,
  filename text NOT NULL,
  original_name text,
  mime_type text NOT NULL,
  data_base64 text NOT NULL,
  size integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_folder_filename
ON public.uploaded_files (folder, filename);
