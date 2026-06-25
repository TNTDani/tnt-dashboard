-- migration_ats_relations_patch1.sql
-- Patch: exclude fee-less placements from account_revenue view.
-- A placement row with fee_amount IS NULL means "placed but fee not yet set"
-- and must not contribute €0 to any revenue aggregates.

CREATE OR REPLACE VIEW account_revenue AS
SELECT
  p.account_id,
  p.agency_id,
  COUNT(*)                                                                AS placement_count,
  SUM(p.fee_amount)                                                       AS total_fees,
  SUM(CASE WHEN p.invoice_status = 'paid'    THEN p.fee_amount ELSE 0 END) AS collected_fees,
  SUM(CASE WHEN p.invoice_status = 'sent'    THEN p.fee_amount ELSE 0 END) AS invoiced_fees,
  SUM(CASE WHEN p.invoice_status = 'draft'   THEN p.fee_amount ELSE 0 END) AS draft_fees
FROM placements p
WHERE p.account_id IS NOT NULL
  AND p.fee_amount IS NOT NULL
GROUP BY p.account_id, p.agency_id;
