-- 058: Add Google Drive references to matters and assignments
-- Matters get a Drive folder; assignments get a Drive doc.

alter table legal_matters
  add column if not exists google_drive_folder_id text,
  add column if not exists google_drive_folder_url text;

alter table assignments
  add column if not exists google_drive_file_id text,
  add column if not exists google_drive_url text;
