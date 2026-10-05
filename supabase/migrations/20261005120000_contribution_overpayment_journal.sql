-- Contribution overpayments in the books.
-- When an M-Pesa/STK payment is larger than what is still owed on a contribution,
-- complete_payment_intent applies only the amount owed and leaves the change in the
-- member's wallet. The journal posted the whole receipt to 3000 dues clearing, so
-- dues were overstated and 2000 wallet liability was understated by the change.
--
-- The receipt entry is unchanged (Dr 1000 / Cr 3000, full amount received). A second
-- entry moves the change to the wallet: Dr 3000 dues clearing / Cr 2000 wallet
-- liability — the same accounts pay_contribution uses for wallet-funded dues, reversed.
-- Same posting for new payments and history, so this also backfills.

-- 1. Post the change for one completed contribution intent (idempotent via source_type/source_id).
CREATE OR REPLACE FUNCTION private.post_journal_for_contribution_change(p_intent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_applied NUMERIC;
  v_change NUMERIC;
  v_jamiya UUID;
BEGIN
  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id;
  IF NOT FOUND OR v_intent.status <> 'completed'
     OR coalesce(v_intent.metadata->>'kind', '') <> 'contribution' THEN
    RETURN NULL;
  END IF;

  -- The contribution debit is what was applied to dues; the rest stayed in the wallet.
  SELECT t.amount, t.jamiya_id INTO v_applied, v_jamiya
  FROM public.transactions t
  WHERE t.id = nullif(v_intent.metadata->>'debit_transaction_id', '')::uuid
    AND t.type = 'contribution'
    AND t.direction = 'debit';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_change := v_intent.amount - v_applied;
  IF v_change <= 0 THEN
    RETURN NULL;
  END IF;

  RETURN private.post_balanced_journal(
    'contribution_change',
    v_intent.id::text,
    'CONTRIBUTIONS',
    'Contribution overpayment to wallet',
    v_intent.currency,
    '3000',
    '2000',
    v_change,
    v_intent.id,
    v_jamiya,
    v_intent.user_id,
    jsonb_build_object(
      'kind', 'contribution_change',
      'contribution_id', v_intent.metadata->>'contribution_id',
      'debit_transaction_id', v_intent.metadata->>'debit_transaction_id',
      'received', v_intent.amount,
      'applied', v_applied
    )
  );
END;
$$;

-- 2. post_journal_for_payment_intent: unchanged except for the change posting at the end,
--    so complete_payment_intent, the completion trigger and the backfill RPCs all get it.
CREATE OR REPLACE FUNCTION private.post_journal_for_payment_intent(p_intent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_kind TEXT;
  v_domain TEXT;
  v_debit TEXT;
  v_credit TEXT;
  v_desc TEXT;
  v_jamiya UUID;
  v_entry UUID;
BEGIN
  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_intent.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  v_kind := coalesce(v_intent.metadata->>'kind', 'wallet_top_up');
  v_jamiya := nullif(v_intent.metadata->>'jamiya_id', '')::uuid;
  IF v_jamiya IS NULL AND (v_intent.metadata->>'contribution_id') IS NOT NULL THEN
    SELECT jamiya_id INTO v_jamiya
    FROM public.contributions
    WHERE id = (v_intent.metadata->>'contribution_id')::uuid;
  END IF;

  CASE v_kind
    WHEN 'contribution' THEN
      v_domain := 'CONTRIBUTIONS';
      v_debit := '1000';
      v_credit := '3000';
      v_desc := 'Contribution collection';
    WHEN 'sadaka' THEN
      v_domain := 'SADAKA';
      v_debit := '1000';
      v_credit := '5000';
      v_desc := 'Sadaka donation';
    WHEN 'sponsorship' THEN
      v_domain := 'TAKAFUL';
      v_debit := '1000';
      v_credit := '6000';
      v_desc := 'Sponsorship charge';
    WHEN 'platform_tip' THEN
      v_domain := 'OPERATING';
      v_debit := '1000';
      v_credit := '2100';
      v_desc := 'Platform tip';
    ELSE
      v_domain := 'OPERATING';
      v_debit := '1000';
      v_credit := '2000';
      v_desc := 'Wallet top-up';
  END CASE;

  v_entry := private.post_balanced_journal(
    'payment_intent',
    v_intent.id::text,
    v_domain,
    v_desc,
    v_intent.currency,
    v_debit,
    v_credit,
    v_intent.amount,
    v_intent.id,
    v_jamiya,
    v_intent.user_id,
    jsonb_build_object('kind', v_kind) || coalesce(v_intent.metadata, '{}'::jsonb)
  );

  IF v_kind = 'contribution' THEN
    PERFORM private.post_journal_for_contribution_change(v_intent.id);
  END IF;

  RETURN v_entry;
END;
$$;

-- 3. Backfill history.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.payment_intents
    WHERE status = 'completed' AND metadata->>'kind' = 'contribution'
  LOOP
    PERFORM private.post_journal_for_contribution_change(r.id);
  END LOOP;
END;
$$;
