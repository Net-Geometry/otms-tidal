-- View for PRF outstanding balances based on linked PV total_amounts.
-- A PRF is "outstanding" when sum(PV.total_amount where status != rejected/cancelled/draft) < PRF.total_amount.
-- Used by the PV form to show only PRFs with remaining balance, and their remaining amount.

CREATE OR REPLACE VIEW public.prf_outstanding_balances AS
SELECT
  prf.id AS prf_id,
  prf.prf_number,
  prf.company_id,
  prf.payable_to,
  prf.priority,
  prf.prf_date,
  prf.total_amount,
  COALESCE(SUM(pv.total_amount) FILTER (WHERE pv.status NOT IN ('rejected', 'cancelled', 'draft')), 0) AS allocated_amount,
  prf.total_amount - COALESCE(SUM(pv.total_amount) FILTER (WHERE pv.status NOT IN ('rejected', 'cancelled', 'draft')), 0) AS outstanding_amount
FROM public.purchase_requisitions prf
LEFT JOIN public.payment_vouchers pv ON pv.prf_id = prf.id
WHERE prf.status = 'approved'
GROUP BY prf.id, prf.prf_number, prf.company_id, prf.payable_to, prf.priority, prf.prf_date, prf.total_amount;

GRANT SELECT ON public.prf_outstanding_balances TO authenticated;
