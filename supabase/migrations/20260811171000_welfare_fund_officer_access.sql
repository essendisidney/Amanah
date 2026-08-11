-- Align ensure_welfare_fund with Finance UI (admin / chair / treasurer)
CREATE OR REPLACE FUNCTION public.ensure_welfare_fund(p_jamiya_id UUID, p_contribution_amount NUMERIC DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.jamiya_id = p_jamiya_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role::text IN ('circle_admin', 'chair', 'treasurer')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  INSERT INTO public.welfare_funds (jamiya_id, contribution_amount, currency)
  SELECT p_jamiya_id, greatest(p_contribution_amount, 0), j.currency
  FROM public.jamiyas j WHERE j.id = p_jamiya_id
  ON CONFLICT (jamiya_id) DO UPDATE
    SET contribution_amount = EXCLUDED.contribution_amount
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'fund_id', v_id);
END;
$$;
