-- Agregar duración a los gastos de publicidad
alter table public.ad_spend
add column if not exists duration_days integer default 1;
