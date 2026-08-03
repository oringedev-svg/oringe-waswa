-- P0 pooled-work claim: serialize ownership at the database boundary.
-- NOWAIT makes a simultaneous claimant fail immediately instead of waiting
-- and then discovering a stale state after the first claimant has finished.
CREATE OR REPLACE FUNCTION claim_work_item(
  p_work_item_id UUID,
  p_claimant_profile_id UUID
)
RETURNS TABLE (id UUID, matter_id UUID, submission_id UUID, title TEXT, instructions TEXT, due_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item work_items%ROWTYPE;
BEGIN
  SELECT * INTO item FROM work_items WHERE work_items.id = p_work_item_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work item not found' USING ERRCODE = 'P0002';
  END IF;
  IF item.status <> 'queued' OR item.assigned_to_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Work item is no longer available to claim' USING ERRCODE = 'P0001';
  END IF;

  UPDATE work_items
  SET assigned_to_profile_id = p_claimant_profile_id,
      status = 'in_progress',
      updated_at = NOW()
  WHERE work_items.id = p_work_item_id;

  RETURN QUERY SELECT item.id, item.matter_id, item.submission_id, item.title, item.instructions, item.due_at;
END;
$$;

REVOKE ALL ON FUNCTION claim_work_item(UUID, UUID) FROM PUBLIC;
