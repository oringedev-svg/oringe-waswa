-- Apply after 037_recruitment_pipeline.sql. This short migration adds the
-- recruitment link to the shared calendar without taking locks on both
-- calendar_events and job_applications in one broad schema transaction.
--
-- The foreign key is added NOT VALID: new writes are protected immediately,
-- while validation can be scheduled during a quiet maintenance window.
SET lock_timeout = '5s';

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS job_application_id UUID;

CREATE INDEX IF NOT EXISTS idx_calendar_events_job_application
  ON calendar_events(job_application_id);

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_job_application_id_fkey
  FOREIGN KEY (job_application_id)
  REFERENCES job_applications(id)
  ON DELETE SET NULL
  NOT VALID;
