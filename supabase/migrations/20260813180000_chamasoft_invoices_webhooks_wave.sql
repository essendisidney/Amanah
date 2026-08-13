-- Contribution invoices + bank-alert ingest for webhooks/parsers.

-- ---------------------------------------------------------------------------
-- Contribution invoices (Chamasoft-style member invoicing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.circle_contribution_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jamiya_id UUID NOT NULL REFERENCES public.jamiyas (id) ON DELETE CASCADE,
  contribution_id UUID NOT NULL REFERENCES public.contributions (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount_due NUMERIC(18, 2) NOT NULL CHECK (amount_due > 0),
  currency CHAR(3) NOT NULL DEFAULT 'KES',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paid', 'cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminded_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contribution_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS circle_contribution_invoices_number_uidx
  ON public.circle_contribution_invoices (jamiya_id, invoice_number);
CREATE INDEX IF NOT EXISTS circle_contribution_invoices_status_idx
  ON public.circle_contribution_invoices (jamiya_id, status, due_date);

ALTER TABLE public.circle_contribution_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_contribution_invoices_select ON public.circle_contribution_invoices;
CREATE POLICY circle_contribution_invoices_select ON public.circle_contribution_invoices
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_circle_officer(jamiya_id)
    OR private.is_platform_admin()
  );

DROP POLICY IF EXISTS circle_contribution_invoices_write ON public.circle_contribution_invoices;
CREATE POLICY circle_contribution_invoices_write ON public.circle_contribution_invoices
  FOR ALL TO authenticated
  USING (private.is_circle_officer(jamiya_id) OR private.is_platform_admin())
  WITH CHECK (private.is_circle_officer(jamiya_id) OR private.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.circle_contribution_invoices TO authenticated;

-- Issue invoices for pending/late/partial contributions
CREATE OR REPLACE FUNCTION public.issue_contribution_invoices(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_slug TEXT;
  v_count INT := 0;
  v_row RECORD;
  v_due NUMERIC;
  v_num TEXT;
  v_seq INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT slug INTO v_slug FROM public.jamiyas WHERE id = p_jamiya_id;
  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT COALESCE(count(*), 0)::int INTO v_seq
  FROM public.circle_contribution_invoices WHERE jamiya_id = p_jamiya_id;

  FOR v_row IN
    SELECT c.*, m.user_id AS member_user_id
    FROM public.contributions c
    JOIN public.members m ON m.id = c.member_id
    WHERE c.jamiya_id = p_jamiya_id
      AND c.status IN ('pending', 'late', 'partial')
      AND NOT EXISTS (
        SELECT 1 FROM public.circle_contribution_invoices i
        WHERE i.contribution_id = c.id AND i.status IN ('open', 'paid')
      )
    ORDER BY c.due_date NULLS LAST, c.created_at
  LOOP
    v_due := GREATEST(v_row.amount - COALESCE(v_row.amount_paid, 0), 0);
    IF v_due <= 0 THEN
      CONTINUE;
    END IF;
    v_seq := v_seq + 1;
    v_num := 'INV-' || upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'gi'), 6))
      || '-' || lpad(v_seq::text, 4, '0');

    INSERT INTO public.circle_contribution_invoices (
      jamiya_id, contribution_id, member_id, user_id, invoice_number,
      amount_due, currency, due_date, status, notes
    ) VALUES (
      p_jamiya_id, v_row.id, v_row.member_id, v_row.member_user_id, v_num,
      v_due, v_row.currency, v_row.due_date, 'open',
      format('Cycle %s contribution', coalesce(v_row.cycle_number::text, '?'))
    );

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_row.member_user_id,
      'contribution_due'::public.notification_type,
      'in_app'::public.notification_channel,
      'Contribution invoice ' || v_num,
      format('Invoice %s for %s is due%s. Pay from Dashboard or Wallet.',
        v_num,
        v_due::text,
        CASE WHEN v_row.due_date IS NOT NULL THEN ' by ' || v_row.due_date::text ELSE '' END
      ),
      jsonb_build_object(
        'jamiya_id', p_jamiya_id,
        'contribution_id', v_row.id,
        'invoice_number', v_num
      )
    );

    v_count := v_count + 1;
  END LOOP;

  -- Mark invoices paid when contribution already settled
  UPDATE public.circle_contribution_invoices i
  SET status = 'paid', paid_at = NOW()
  FROM public.contributions c
  WHERE i.jamiya_id = p_jamiya_id
    AND i.contribution_id = c.id
    AND i.status = 'open'
    AND c.status = 'paid';

  RETURN jsonb_build_object('ok', true, 'issued', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_contribution_invoices(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_contribution_invoices(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.remind_contribution_invoices(p_jamiya_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INT := 0;
  v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.circle_contribution_invoices
    WHERE jamiya_id = p_jamiya_id AND status = 'open'
    ORDER BY due_date NULLS LAST
  LOOP
    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      v_row.user_id,
      'contribution_due'::public.notification_type,
      'in_app'::public.notification_channel,
      'Reminder: ' || v_row.invoice_number,
      format('Please pay invoice %s (%s %s)%s.',
        v_row.invoice_number,
        v_row.currency,
        v_row.amount_due::text,
        CASE WHEN v_row.due_date IS NOT NULL THEN ' due ' || v_row.due_date::text ELSE '' END
      ),
      jsonb_build_object(
        'jamiya_id', p_jamiya_id,
        'contribution_id', v_row.contribution_id,
        'invoice_number', v_row.invoice_number,
        'reminder', true
      )
    );
    UPDATE public.circle_contribution_invoices
    SET reminded_at = NOW()
    WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reminded', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.remind_contribution_invoices(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remind_contribution_invoices(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Ingest bank alert (webhook / parser path; service_role or officer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_bank_alert(
  p_jamiya_id UUID,
  p_provider TEXT,
  p_alert_text TEXT,
  p_amount NUMERIC DEFAULT NULL,
  p_direction TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'KES',
  p_external_ref TEXT DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := coalesce(auth.role(), '');
  v_id UUID;
  v_provider TEXT := lower(btrim(COALESCE(p_provider, 'other')));
  v_direction TEXT := lower(btrim(COALESCE(p_direction, '')));
  v_currency CHAR(3) := left(upper(coalesce(nullif(btrim(p_currency), ''), 'KES')), 3);
BEGIN
  IF v_uid IS NOT NULL THEN
    IF NOT (private.is_circle_officer(p_jamiya_id) OR private.is_platform_admin()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
    END IF;
  ELSIF v_role IS DISTINCT FROM 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jamiyas WHERE id = p_jamiya_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_provider NOT IN ('manual', 'equity', 'mpesa', 'other') THEN
    v_provider := 'other';
  END IF;
  IF v_direction NOT IN ('credit', 'debit') THEN
    v_direction := NULL;
  END IF;

  IF p_external_ref IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.circle_bank_alerts
    WHERE jamiya_id = p_jamiya_id AND external_ref = p_external_ref
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'alert_id', v_id, 'duplicate', true);
    END IF;
  END IF;

  INSERT INTO public.circle_bank_alerts (
    jamiya_id, bank_account_id, provider, external_ref, alert_text,
    amount, currency, direction, occurred_at, status, created_by
  ) VALUES (
    p_jamiya_id, p_bank_account_id, v_provider, p_external_ref,
    nullif(btrim(COALESCE(p_alert_text, '')), ''),
    p_amount, v_currency, v_direction,
    COALESCE(p_occurred_at, NOW()), 'pending', v_uid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'alert_id', v_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_bank_alert(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_bank_alert(
  UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ
) TO authenticated, service_role;
