-- New circles start with no loan profit; officers can set a rate per circle.
-- Existing circles keep the rate they already use.
alter table public.jamiyas alter column loan_profit_rate_pct set default 0;
