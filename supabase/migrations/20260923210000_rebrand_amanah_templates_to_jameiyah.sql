-- Rebrand product-owned notification / invite templates from Amanah → Jameiyah.
-- Does not rewrite historical notification rows or user-authored content.

UPDATE public.collection_playbook_steps
SET
  template_body = replace(template_body, 'Amanah', 'Jameiyah'),
  template_subject = replace(coalesce(template_subject, ''), 'Amanah', 'Jameiyah')
WHERE template_body ILIKE '%Amanah%'
   OR coalesce(template_subject, '') ILIKE '%Amanah%';

-- Refresh invite RPCs that still hard-code Amanah in source migrations.
-- (Function bodies are replaced by later migrations; patch live definitions via search-replace of known strings is fragile.)
-- Instead update any stored default notification templates if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_templates'
  ) THEN
    EXECUTE $u$
      UPDATE public.notification_templates
      SET
        body = replace(body, 'Amanah', 'Jameiyah'),
        title = replace(title, 'Amanah', 'Jameiyah'),
        updated_at = NOW()
      WHERE body ILIKE '%Amanah%' OR title ILIKE '%Amanah%'
    $u$;
  END IF;
END $$;
