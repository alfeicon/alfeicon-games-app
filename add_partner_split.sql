-- Reparto de ganancias con socio: agrega el % que se lleva el socio en cada venta.
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table public.sales
add column if not exists partner_pct integer check (partner_pct is null or (partner_pct between 0 and 100));

insert into public.app_settings (key, value, label)
values ('partner_split_pct', 40, 'Porcentaje del socio por defecto en ventas nuevas')
on conflict (key) do nothing;
