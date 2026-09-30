-- Applied to production 2026-09-30 (version 20260930070903).
-- Rebrand to Jameiyah: function bodies, Sadaka custody value, phone-login placeholder
-- emails, and stored notification text. The old-name literals below are the values
-- being replaced, so they have to appear here.

do $$
declare r record; def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.prosrc ~* 'amanah'
  loop
    def := pg_get_functiondef(r.oid);
    def := replace(def, 'https://amanah-liart.vercel.app', 'https://jameiyah.com');
    def := replace(def, 'NOT LIKE ''%@amanah.internal''', 'NOT LIKE ''%.internal''');
    def := replace(def, 'amanah_pass_through', 'jameiyah_pass_through');
    def := replace(def, 'Amanah', 'Jameiyah');
    def := replace(def, 'amanah', 'jameiyah');
    execute def;
  end loop;
end $$;

alter table public.charity_campaigns drop constraint charity_campaigns_custody_mode_check;
update public.charity_campaigns set custody_mode = 'jameiyah_pass_through' where custody_mode = 'amanah_pass_through';
alter table public.charity_campaigns alter column custody_mode set default 'jameiyah_pass_through';
alter table public.charity_campaigns add constraint charity_campaigns_custody_mode_check
  check (custody_mode in ('jameiyah_pass_through','psp_subaccount'));

update auth.users
   set email = replace(email, '@amanah.internal', '@jameiyah.internal')
 where email like '%@amanah.internal';
update auth.identities
   set identity_data = jsonb_set(identity_data, '{email}',
         to_jsonb(replace(identity_data->>'email', '@amanah.internal', '@jameiyah.internal')))
 where identity_data->>'email' like '%@amanah.internal';
update public.profiles
   set email = replace(email, '@amanah.internal', '@jameiyah.internal')
 where email like '%@amanah.internal';

update public.notifications
   set title = replace(replace(title, 'Amanah', 'Jameiyah'), '@amanah.internal', '@jameiyah.internal'),
       body  = replace(replace(body,  'Amanah', 'Jameiyah'), '@amanah.internal', '@jameiyah.internal')
 where title ~* 'amanah' or body ~* 'amanah';
update public.notification_outbox
   set subject   = replace(replace(replace(subject, 'https://amanah-liart.vercel.app', 'https://jameiyah.com'), 'Amanah', 'Jameiyah'), '@amanah.internal', '@jameiyah.internal'),
       body      = replace(replace(replace(body,    'https://amanah-liart.vercel.app', 'https://jameiyah.com'), 'Amanah', 'Jameiyah'), '@amanah.internal', '@jameiyah.internal'),
       recipient = replace(recipient, '@amanah.internal', '@jameiyah.internal')
 where coalesce(subject,'') ~* 'amanah' or body ~* 'amanah' or recipient ~* 'amanah';

update public.charity_campaigns
   set slug = 'jameiyah-community-relief',
       title = replace(title, 'Amanah', 'Jameiyah'),
       summary = replace(summary, 'Amanah', 'Jameiyah'),
       description = replace(description, 'Amanah', 'Jameiyah')
 where slug = 'amanah-community-relief';
