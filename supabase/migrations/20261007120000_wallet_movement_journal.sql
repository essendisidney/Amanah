-- Journal the wallet movements that never reached the books.
-- Welfare contributions and claims, savings-pocket moves, circle dividends, circle payouts
-- and Qard disbursements changed member wallets (2000) without a journal entry, and
-- repay_qard posted Dr 4100 / Cr 4000 with no wallet side. Every such wallet transaction
-- now posts one balanced entry (source_type 'wallet_movement', source_id = transaction id)
-- from a trigger on transactions, so all current and future callers are covered, and
-- history is backfilled below.
--
--   kind                   wallet   journal
--   welfare_contribution   debit    Dr 2000 / Cr 6000
--   welfare_claim          credit   Dr 6000 / Cr 2000
--   pocket_deposit         debit    Dr 2000 / Cr 3000
--   pocket_withdraw        credit   Dr 3000 / Cr 2000
--   circle_dividend        credit   Dr 3000 / Cr 2000
--   circle payout          credit   Dr 3000 / Cr 2000   (settle_payout, service_settle_payout)
--   qard_disbursement      credit   Dr 4000 / Cr 2000
--   qard_repayment         debit    Dr 2000 / Cr 4100   (repay_qard's own Dr 4100 / Cr 4000
--                                                       stays, so 4100 nets to zero and the
--                                                       pair reads Dr 2000 / Cr 4000)

-- ---------------------------------------------------------------------------
-- Which accounts a wallet transaction moves between (NULL = journaled elsewhere or unknown)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.wallet_movement_accounts(p_tx public.transactions)
RETURNS TABLE (debit_code TEXT, credit_code TEXT, domain TEXT, description TEXT)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT m.debit_code, m.credit_code, m.domain, m.description
  FROM (
    SELECT
      coalesce(
        p_tx.metadata->>'kind',
        CASE
          WHEN p_tx.type = 'qard_repayment' THEN 'qard_repayment'
          WHEN p_tx.type = 'payout' AND p_tx.metadata ? 'payout_id' THEN 'circle_payout'
        END
      ) AS kind
  ) k
  JOIN (VALUES
    ('welfare_contribution', 'debit',  '2000', '6000', 'TAKAFUL',       'Welfare contribution'),
    ('welfare_claim',        'credit', '6000', '2000', 'TAKAFUL',       'Welfare claim paid'),
    ('pocket_deposit',       'debit',  '2000', '3000', 'CONTRIBUTIONS', 'Savings pocket deposit'),
    ('pocket_withdraw',      'credit', '3000', '2000', 'CONTRIBUTIONS', 'Savings pocket withdrawal'),
    ('circle_dividend',      'credit', '3000', '2000', 'CONTRIBUTIONS', 'Circle dividend'),
    ('circle_payout',        'credit', '3000', '2000', 'CONTRIBUTIONS', 'Circle payout'),
    ('qard_disbursement',    'credit', '4000', '2000', 'QARD',          'Qard Hassan disbursement'),
    ('qard_repayment',       'debit',  '2000', '4100', 'QARD',          'Qard Hassan repayment (wallet)')
  ) AS m(kind, direction, debit_code, credit_code, domain, description)
    ON m.kind = k.kind AND m.direction = p_tx.direction;
$$;

-- ---------------------------------------------------------------------------
-- Post one wallet transaction (idempotent through post_balanced_journal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.post_journal_for_wallet_movement(p_tx_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_map RECORD;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id;
  IF NOT FOUND OR v_tx.status <> 'completed' OR coalesce(v_tx.amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_map FROM private.wallet_movement_accounts(v_tx);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN private.post_balanced_journal(
    'wallet_movement',
    v_tx.id::text,
    v_map.domain,
    v_map.description,
    v_tx.currency,
    v_map.debit_code,
    v_map.credit_code,
    v_tx.amount,
    NULL,
    v_tx.jamiya_id,
    v_tx.user_id,
    jsonb_build_object(
      'transaction_id', v_tx.id,
      'kind', coalesce(v_tx.metadata->>'kind', v_tx.type::text),
      'reference', v_tx.reference
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_wallet_movement_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.post_journal_for_wallet_movement(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER wallet_movement_journal
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW
WHEN (NEW.status = 'completed' AND NEW.type IN ('contribution', 'payout', 'qard_repayment'))
EXECUTE FUNCTION private.trg_wallet_movement_journal();

REVOKE ALL ON FUNCTION private.wallet_movement_accounts(public.transactions) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.post_journal_for_wallet_movement(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_wallet_movement_journal() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: every completed movement above that has no entry yet
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT t.id
    FROM public.transactions t
    WHERE t.status = 'completed'
      AND t.type IN ('contribution', 'payout', 'qard_repayment')
      AND NOT EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.source_type = 'wallet_movement' AND je.source_id = t.id::text
      )
    ORDER BY t.created_at
  LOOP
    PERFORM private.post_journal_for_wallet_movement(v_id);
  END LOOP;
END;
$$;
