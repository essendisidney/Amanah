-- Admin product insights: activation, payment funnel, circle health
create or replace function public.admin_product_insights()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role public.platform_role;
  v_now timestamptz := now();
  v_7d timestamptz := now() - interval '7 days';
  v_30d timestamptz := now() - interval '30 days';
  v_14d timestamptz := now() - interval '14 days';
begin
  select platform_role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('platform_admin', 'super_admin', 'compliance_officer') then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'generated_at', v_now,
    'activation', jsonb_build_object(
      'profiles_total', (select count(*)::int from profiles),
      'profiles_7d', (select count(*)::int from profiles where created_at >= v_7d),
      'profiles_30d', (select count(*)::int from profiles where created_at >= v_30d),
      'with_membership', (
        select count(distinct user_id)::int from members where status = 'active'
      ),
      'with_paid_contribution', (
        select count(distinct m.user_id)::int
        from contributions c
        join members m on m.id = c.member_id
        where c.status = 'paid'
      ),
      'avg_hours_to_first_pay', (
        select round(avg(extract(epoch from (first_pay - p.created_at)) / 3600.0)::numeric, 1)
        from profiles p
        join lateral (
          select min(coalesce(c.paid_at, c.updated_at)) as first_pay
          from members m
          join contributions c on c.member_id = m.id and c.status = 'paid'
          where m.user_id = p.id
        ) fp on fp.first_pay is not null
      ),
      'officers_active', (
        select count(*)::int from members
        where status = 'active'
          and role in ('circle_admin', 'chair', 'treasurer', 'secretary')
      ),
      'members_active', (
        select count(*)::int from members where status = 'active' and role = 'member'
      ),
      'invites_pending', (
        select count(*)::int from invitations where status = 'pending'
      ),
      'invites_accepted', (
        select count(*)::int from invitations where status = 'accepted'
      )
    ),
    'payments', jsonb_build_object(
      'intents_total', (select count(*)::int from payment_intents),
      'intents_by_status', coalesce((
        select jsonb_object_agg(status, n) from (
          select status::text as status, count(*)::int as n
          from payment_intents group by 1
        ) s
      ), '{}'::jsonb),
      'intents_by_provider', coalesce((
        select jsonb_object_agg(provider, n) from (
          select provider::text as provider, count(*)::int as n
          from payment_intents group by 1
        ) s
      ), '{}'::jsonb),
      'intents_7d', (select count(*)::int from payment_intents where created_at >= v_7d),
      'intents_completed_7d', (
        select count(*)::int from payment_intents
        where created_at >= v_7d and status = 'completed'
      ),
      'intents_failed_7d', (
        select count(*)::int from payment_intents
        where created_at >= v_7d
          and status::text in ('failed', 'expired', 'cancelled')
      ),
      'top_errors', coalesce((
        select jsonb_agg(jsonb_build_object('error', error_message, 'n', n) order by n desc)
        from (
          select coalesce(nullif(trim(error_message), ''), '(no message)') as error_message,
                 count(*)::int as n
          from payment_intents
          where status::text in ('failed', 'expired', 'cancelled')
            and created_at >= v_30d
          group by 1
          order by 2 desc
          limit 8
        ) e
      ), '[]'::jsonb),
      'transactions_by_type', coalesce((
        select jsonb_object_agg(type, n) from (
          select type::text as type, count(*)::int as n
          from transactions where created_at >= v_30d group by 1
        ) s
      ), '{}'::jsonb),
      'transactions_completed_30d', (
        select count(*)::int from transactions
        where created_at >= v_30d and status = 'completed'
      ),
      'contribution_payments_30d', (
        select count(*)::int from contribution_payments where created_at >= v_30d
      ),
      'payment_methods', coalesce((
        select jsonb_object_agg(method, n) from (
          select coalesce(nullif(payment_method, ''), 'unspecified') as method,
                 count(*)::int as n
          from contribution_payments
          where created_at >= v_30d
          group by 1
        ) s
      ), '{}'::jsonb)
    ),
    'circle_health', jsonb_build_object(
      'circles_total', (select count(*)::int from jamiyas),
      'circles_active', (
        select count(*)::int from jamiyas where status in ('active', 'open')
      ),
      'contributions_paid', (
        select count(*)::int from contributions where status = 'paid'
      ),
      'contributions_pending', (
        select count(*)::int from contributions where status = 'pending'
      ),
      'contributions_overdue', (
        select count(*)::int from contributions
        where status = 'pending' and due_date < current_date
      ),
      'on_time_rate_pct', (
        select case
          when count(*) filter (where status = 'paid') = 0 then null
          else round(
            100.0 * count(*) filter (
              where status = 'paid'
                and paid_at is not null
                and paid_at::date <= due_date
            ) / count(*) filter (where status = 'paid'),
            1
          )
        end
        from contributions
        where due_date is not null
      ),
      'open_collection_cases', (
        select count(*)::int from collection_cases
        where status::text in ('open', 'contacted', 'promised', 'partially_paid')
      ),
      'dormant_circles_14d', (
        select count(*)::int from jamiyas j
        where not exists (
          select 1 from contribution_payments cp
          join contributions c on c.id = cp.contribution_id
          where c.jamiya_id = j.id and cp.created_at >= v_14d
        )
        and not exists (
          select 1 from transactions t
          where t.jamiya_id = j.id and t.created_at >= v_14d and t.status = 'completed'
        )
      ),
      'circles', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'name', j.name,
            'slug', j.slug,
            'status', j.status::text,
            'members', coalesce(j.member_count, 0),
            'pending', (
              select count(*)::int from contributions c
              where c.jamiya_id = j.id and c.status = 'pending'
            ),
            'paid', (
              select count(*)::int from contributions c
              where c.jamiya_id = j.id and c.status = 'paid'
            ),
            'overdue', (
              select count(*)::int from contributions c
              where c.jamiya_id = j.id and c.status = 'pending' and c.due_date < current_date
            )
          )
          order by j.name
        )
        from jamiyas j
        limit 50
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_product_insights() from public;
grant execute on function public.admin_product_insights() to authenticated;
