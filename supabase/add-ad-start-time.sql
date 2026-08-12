-- Guarda la hora exacta en que comienza cada campaña.
-- Las campañas antiguas seguirán usando su fecha a las 00:00.
alter table public.ad_spend
  add column if not exists start_at timestamptz;

update public.ad_spend
set start_at = (date::text || 'T00:00:00')::timestamptz
where start_at is null;
