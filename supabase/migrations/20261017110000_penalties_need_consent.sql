-- Late penalties need the member's consent, like circle fees.
--
-- Step 1 (20261008120000) made every circle fee wait until the member accepts the circle's terms,
-- and charge the lower of the accepted and current amounts. The automatic late penalties were
-- left out: assess_contribution_penalties (also run by run_auto_fines) and assess_loan_penalties
-- charged the circle's current rate to everyone. They now charge only what each member accepted,
-- so a member who has not accepted any terms is not charged, and a raised penalty applies only
-- once the member accepts it. Officers can still levy a fine by hand (levy_member_fine).

CREATE OR REPLACE FUNCTION public.assess_loan_penalties(p_jamiya_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count INT := 0;
  r RECORD;
  v_amt NUMERIC;
BEGIN
  FOR r IN
    SELECT
      l.id AS loan_id,
      l.jamiya_id,
      l.borrower_id,
      l.amount,
      l.amount_repaid,
      l.currency,
      l.due_date,
      j.late_loan_penalty_fixed,
      j.late_loan_penalty_pct,
      m.id AS member_id
    FROM public.qard_loans l
    JOIN public.jamiyas j ON j.id = l.jamiya_id
    JOIN public.members m ON m.jamiya_id = l.jamiya_id AND m.user_id = l.borrower_id
    WHERE l.status = 'active'
      AND l.due_date IS NOT NULL
      AND l.due_date < CURRENT_DATE
      AND l.amount_repaid < l.amount
      AND (j.late_loan_penalty_fixed > 0 OR j.late_loan_penalty_pct > 0)
      AND (p_jamiya_id IS NULL OR l.jamiya_id = p_jamiya_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.penalties p
        WHERE p.qard_loan_id = l.id
          AND p.kind = 'late_loan'
          AND p.status IN ('open', 'paid')
          AND p.assessed_at::date = CURRENT_DATE
      )
  LOOP
    -- Only what the borrower accepted in the circle's terms (the lower of accepted and current).
    v_amt := private.agreed_circle_fee(r.borrower_id, r.jamiya_id, 'late_loan_penalty_fixed')
      + ROUND(
          GREATEST(r.amount - r.amount_repaid, 0)
            * private.agreed_circle_fee(r.borrower_id, r.jamiya_id, 'late_loan_penalty_pct') / 100.0,
          2
        );
    IF v_amt <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.penalties (
      jamiya_id, member_id, user_id, kind, amount, currency, qard_loan_id, notes
    ) VALUES (
      r.jamiya_id, r.member_id, r.borrower_id, 'late_loan', v_amt, r.currency,
      r.loan_id, 'Auto-assessed late loan penalty'
    );
    v_count := v_count + 1;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      r.borrower_id,
      'system',
      'in_app',
      'Late loan penalty',
      'A penalty of ' || v_amt::text || ' ' || r.currency || ' was assessed on your facility.',
      jsonb_build_object('loan_id', r.loan_id, 'penalty', v_amt)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'assessed', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.assess_contribution_penalties(p_jamiya_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count INT := 0;
  r RECORD;
  v_amt NUMERIC;
BEGIN
  FOR r IN
    SELECT c.id AS contribution_id, c.jamiya_id, c.member_id, m.user_id, j.currency,
           j.late_contribution_penalty AS penalty_amt
    FROM public.contributions c
    JOIN public.members m ON m.id = c.member_id
    JOIN public.jamiyas j ON j.id = c.jamiya_id
    WHERE c.status IN ('late', 'partial')
      AND j.late_contribution_penalty > 0
      AND (p_jamiya_id IS NULL OR c.jamiya_id = p_jamiya_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.penalties p
        WHERE p.contribution_id = c.id AND p.kind = 'late_contribution'
      )
  LOOP
    -- Only what the member accepted in the circle's terms (the lower of accepted and current).
    v_amt := private.agreed_circle_fee(r.user_id, r.jamiya_id, 'late_contribution_penalty');
    IF v_amt <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.penalties (
      jamiya_id, member_id, user_id, kind, amount, currency, contribution_id, notes
    ) VALUES (
      r.jamiya_id, r.member_id, r.user_id, 'late_contribution', v_amt, r.currency,
      r.contribution_id, 'Auto-assessed late contribution penalty'
    );
    v_count := v_count + 1;

    INSERT INTO public.notifications (user_id, type, channel, title, body, data)
    VALUES (
      r.user_id,
      'contribution_due',
      'in_app',
      'Late contribution penalty',
      'A penalty of ' || v_amt::text || ' ' || r.currency || ' was assessed.',
      jsonb_build_object('contribution_id', r.contribution_id, 'penalty', v_amt)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'assessed', v_count);
END;
$function$;
