# Merging phone + email admin accounts (ops)

You currently have two profiles both set to `platform_admin`:

- Email / Google: `essendisidney@gmail.com`
- Phone OTP: `+254722210711` (`254722210711@amanah.internal`)

They are separate Auth users. Prefer **one login** for day-to-day:

1. Use **phone** for field/UAT (matches how members join).
2. Or use **email** for admin console on desktop.

True merge (moving circles/wallet from one UUID to another) needs a careful data migration — do not delete either account until that is planned. Both remaining as admin is fine for now.

To confirm roles:

```sql
select id, email, phone, platform_role
from public.profiles
where email ilike '%essendi%'
   or phone like '%722210711%';
```
