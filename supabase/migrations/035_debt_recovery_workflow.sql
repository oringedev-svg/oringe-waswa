-- ============================================================
-- DEBT RECOVERY: FIRST MATTER TYPE ON THE TRIGGER ENGINE
-- ============================================================
-- Proof of concept for branching + deadlines, per the firm's own build
-- order (Debt Recovery first, specifically because it exercises both).
-- The very first activity on a debt recovery matter (drafting the demand
-- letter) is still created manually, the same "Create Work Item" flow
-- already built this session, everything from there on is reactive:
--
--   Draft Demand Letter  --(assignment approved, emits demand_letter_sent)-->
--   [14 days elapse, cron-evaluated]                                    -->
--   demand_letter_response_period_expired                               -->
--   File Suit for Recovery of Debt  --(emits suit_filed)                -->
--   Effect Service of Summons  --(emits service_effected)               -->
--   [15 days elapse]                                                    -->
--   response_period_expired                                            -->
--   Apply for Default Judgment
--
-- with the branch: if 'defence_filed' is emitted (from wherever that gets
-- recorded) before the 15-day window lapses, "Prepare for Hearing" is
-- created instead. Known gap, stated plainly rather than glossed over:
-- nothing here yet cancels the default-judgment branch if a defence
-- arrives after the window is checked but the cron hasn't run again, a
-- race the engine doesn't resolve. Fine for a proof of concept, worth
-- revisiting (e.g. a status guard on the matter) before this runs
-- unattended in production.
--
-- Kenyan CPR periods used below (15-day response window, 14-day demand
-- notice) are common defaults, not verified against current court rules,
-- per the firm's own instruction: review each matter type against actual
-- practice before treating it as production-ready. Treat the day counts
-- as placeholders to confirm, not settled advice.

INSERT INTO activity_types (firm_id, activity_key, name, category, default_due_days, eligible_roles, on_complete_event, applies_to_matter_types, completion_schema)
SELECT f.id, v.activity_key, v.name, v.category, v.default_due_days, v.eligible_roles::TEXT[], v.on_complete_event, v.applies_to_matter_types::TEXT[], v.completion_schema::JSONB
FROM firms f
CROSS JOIN (VALUES
  ('draft_demand_letter', 'Draft Demand Letter', 'legal_work', 3, '{admin,staff,pupil}', 'demand_letter_sent', '{debt_recovery}', '{"fields":["document_id","amount_demanded","response_deadline"]}'),
  ('file_suit_debt_recovery', 'File Suit for Recovery of Debt', 'legal_work', 5, '{admin,staff}', 'suit_filed', '{debt_recovery}', '{"fields":["case_number","court","filing_receipt"]}'),
  ('effect_service', 'Effect Service of Summons', 'legal_work', 21, '{admin,staff,pupil}', 'service_effected', '{}', '{"fields":["service_date","service_method","affidavit_of_service"]}'),
  ('apply_default_judgment', 'Apply for Default Judgment', 'legal_work', 5, '{admin,staff}', 'default_judgment_application_filed', '{}', '{"fields":["application_filed_date","filing_receipt"]}'),
  ('prepare_for_hearing', 'Prepare for Hearing', 'legal_work', 7, '{admin,staff,pupil}', NULL, '{}', '{"fields":["hearing_date","bundle_filed"]}')
) AS v(activity_key, name, category, default_due_days, eligible_roles, on_complete_event, applies_to_matter_types, completion_schema)
WHERE f.slug = 'oringe-waswa'
ON CONFLICT (firm_id, activity_key) DO NOTHING;

-- Immediate reactions
INSERT INTO activity_trigger_rules (firm_id, source_event, matter_type, creates_activity_type_id, assignment_strategy)
SELECT f.id, 'demand_letter_response_period_expired', 'debt_recovery', at.id, 'matter_lead'
FROM firms f JOIN activity_types at ON at.activity_key = 'file_suit_debt_recovery' AND at.firm_id = f.id
WHERE f.slug = 'oringe-waswa';

INSERT INTO activity_trigger_rules (firm_id, source_event, matter_type, creates_activity_type_id, assignment_strategy)
SELECT f.id, 'suit_filed', 'debt_recovery', at.id, 'matter_lead'
FROM firms f JOIN activity_types at ON at.activity_key = 'effect_service' AND at.firm_id = f.id
WHERE f.slug = 'oringe-waswa';

INSERT INTO activity_trigger_rules (firm_id, source_event, matter_type, creates_activity_type_id, assignment_strategy)
SELECT f.id, 'response_period_expired', NULL, at.id, 'matter_lead'
FROM firms f JOIN activity_types at ON at.activity_key = 'apply_default_judgment' AND at.firm_id = f.id
WHERE f.slug = 'oringe-waswa';

INSERT INTO activity_trigger_rules (firm_id, source_event, matter_type, creates_activity_type_id, assignment_strategy)
SELECT f.id, 'defence_filed', NULL, at.id, 'matter_lead'
FROM firms f JOIN activity_types at ON at.activity_key = 'prepare_for_hearing' AND at.firm_id = f.id
WHERE f.slug = 'oringe-waswa';

-- Delayed (statutory time) reactions, evaluated by /api/cron/evaluate-triggers
INSERT INTO activity_trigger_rules (firm_id, source_event, matter_type, emits_event, delay_days)
SELECT id, 'demand_letter_sent', 'debt_recovery', 'demand_letter_response_period_expired', 14
FROM firms WHERE slug = 'oringe-waswa';

INSERT INTO activity_trigger_rules (firm_id, source_event, matter_type, emits_event, delay_days)
SELECT id, 'service_effected', NULL, 'response_period_expired', 15
FROM firms WHERE slug = 'oringe-waswa';
