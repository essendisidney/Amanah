-- Applied to production 2026-09-30 (version 20260930065713).
-- Anonymous callers lose EXECUTE on SECURITY DEFINER functions (except 3 public ones);
-- money-creating and batch functions become service-role only.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public' and p.prosecdef and d.objid is null
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated, service_role', r.fn);
  end loop;
end $$;

alter default privileges in schema public revoke execute on functions from public, anon;

grant execute on function public.preview_invitation(text, text) to anon;
grant execute on function public.get_donation_receipt(text) to anon;
grant execute on function public.record_charity_donation(uuid, numeric, text, text, text, boolean) to anon;

do $$
declare
  fn_names text[] := array[
    'wallet_top_up','complete_payment_intent','ingest_webhook_event','finalize_webhook_event',
    'mark_late_contributions','process_circle_subscription_renewals','reward_qualified_referrals',
    'qualify_referral_for_user','assess_contribution_penalties','assess_loan_penalties',
    'match_collection_playbook','claim_notification_outbox','claim_reminder_dedupe',
    'enqueue_contribution_reminder','enqueue_payout_reminder','enqueue_user_reminder',
    'queue_due_sponsorship_charges','service_settle_payout','claim_pending_sadaka_disbursements',
    'mark_outbox_sent','mark_outbox_failed'
  ];
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (fn_names)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end $$;

alter table public.reminder_dedupe enable row level security;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('set_updated_at', 'kenya_phone_digits')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.fn);
  end loop;
end $$;
