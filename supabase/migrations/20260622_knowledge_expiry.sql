-- Document expiry tracking + category classification
ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS expires_at      timestamptz,
  ADD COLUMN IF NOT EXISTS doc_category    text,
  ADD COLUMN IF NOT EXISTS expiry_notified boolean DEFAULT false;

-- Backfill doc_category from filename patterns
UPDATE knowledge_documents SET doc_category = CASE
  WHEN lower(name) LIKE '%trade license%'      THEN 'certification'
  WHEN lower(name) LIKE '%trade licence%'      THEN 'certification'
  WHEN lower(name) LIKE '%iso%'                THEN 'certification'
  WHEN lower(name) LIKE '%certificate%'        THEN 'certification'
  WHEN lower(name) LIKE '%qhse%'               THEN 'certification'
  WHEN lower(name) LIKE '%org chart%'          THEN 'template'
  WHEN lower(name) LIKE '%organizational%'     THEN 'template'
  WHEN lower(name) LIKE '%similar project%'    THEN 'past_project'
  WHEN lower(name) LIKE '%experience%'         THEN 'past_project'
  WHEN lower(name) LIKE '%past project%'       THEN 'past_project'
  WHEN lower(name) LIKE '%sop%'                THEN 'sop'
  WHEN lower(name) LIKE '%procedure%'          THEN 'sop'
  WHEN lower(name) LIKE '%policy%'             THEN 'sop'
  WHEN lower(name) LIKE '%hse plan%'           THEN 'hse_plan'
  WHEN lower(name) LIKE '%health%'             THEN 'hse_plan'
  WHEN lower(name) LIKE '%safety%'             THEN 'hse_plan'
  WHEN lower(name) LIKE '%ppm%'                THEN 'ppm_library'
  WHEN lower(name) LIKE '%maintenance%'        THEN 'ppm_library'
  WHEN lower(name) LIKE '%sla%'                THEN 'sla_library'
  WHEN lower(name) LIKE '%kpi%'                THEN 'kpi_library'
  WHEN lower(name) LIKE '%technical proposal%' THEN 'technical_proposal'
  WHEN lower(name) LIKE '%method statement%'   THEN 'method_statement'
  WHEN lower(name) LIKE '%risk%'               THEN 'risk_register'
  WHEN lower(name) LIKE '%reference%'          THEN 'reference'
  WHEN lower(name) LIKE '%mobilization%'       THEN 'mobilization_plan'
  ELSE 'document'
END
WHERE doc_category IS NULL;

-- Backfill expires_at from year-range patterns in filenames
UPDATE knowledge_documents
SET expires_at = ('2026-12-31'::date)::timestamptz
WHERE lower(name) LIKE '%2025-2026%' AND expires_at IS NULL;

UPDATE knowledge_documents
SET expires_at = ('2025-12-31'::date)::timestamptz
WHERE (lower(name) LIKE '%2022-2025%' OR lower(name) LIKE '%(2022-2025)%') AND expires_at IS NULL;

UPDATE knowledge_documents
SET expires_at = ('2027-12-31'::date)::timestamptz
WHERE lower(name) LIKE '%2026-2027%' AND expires_at IS NULL;
