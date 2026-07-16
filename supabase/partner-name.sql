-- Nombre del socio, editable desde Ajustes. Se usa en el reparto de ganancia
-- y en el pago que le corresponde tras descontar la publicidad.
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table public.app_settings add column if not exists value_text text;

insert into public.app_settings (key, value, value_text, label)
values ('partner_name', 0, 'Diego', 'Nombre del socio para reparto y pagos')
on conflict (key) do nothing;
