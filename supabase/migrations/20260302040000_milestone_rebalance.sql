-- Story 26-4: Rebalance milestone thresholds for 12-month target
-- Active user (feedback+call, no referral) ~110pt/month → Legend in ~12 months
-- Safety: wrap in DO block to verify all 5 levels exist before updating.

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.contribution_milestones
  WHERE level IN (1, 2, 3, 4, 5);

  IF v_count < 5 THEN
    RAISE EXCEPTION 'Expected 5 milestone levels but found %. Aborting rebalance.', v_count;
  END IF;

  UPDATE public.contribution_milestones SET points_required = 110,  updated_at = now() WHERE level = 1;
  UPDATE public.contribution_milestones SET points_required = 330,  updated_at = now() WHERE level = 2;
  UPDATE public.contribution_milestones SET points_required = 660,  updated_at = now() WHERE level = 3;
  UPDATE public.contribution_milestones SET points_required = 1000, updated_at = now() WHERE level = 4;
  UPDATE public.contribution_milestones SET points_required = 1330, updated_at = now() WHERE level = 5;
END;
$$;
