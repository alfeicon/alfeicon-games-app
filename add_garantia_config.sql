-- GARANTÍA CONFIGURABLE
--
-- Los días de garantía dejan de estar fijos en el código y se editan desde
-- Ajustes. Pero el plazo se CONGELA en cada ítem al crearlo: si mañana bajas la
-- garantía de 7 a 5 días, las entregas que ya hiciste mantienen los 7 que les
-- prometiste. Ajustes solo manda sobre las entregas nuevas.
alter table public.order_items
  add column if not exists dias_garantia int;

-- Ítems que ya existían (la migración de add_order_items.sql): el plazo que
-- regía hasta ahora, 7 días juegos y 3 días packs.
update public.order_items
   set dias_garantia = case when item_type = 'pack' then 3 else 7 end
 where dias_garantia is null;

alter table public.order_items
  alter column dias_garantia set default 7;

-- Valores por omisión editables desde Ajustes.
insert into public.app_settings (key, value)
values ('garantia_juego_dias', 7), ('garantia_pack_dias', 3)
on conflict (key) do nothing;


-- VENCIMIENTO
-- Vive en la base porque hay que comparar `completed_at` contra una columna
-- (`dias_garantia`), y eso no se puede expresar como filtro de PostgREST desde
-- el cron. Devuelve cuántas cuentas vació, para poder registrarlo.
--
-- Vaciar la cuenta ES el vencimiento: el enlace deja de servir y no guardamos
-- credenciales para siempre. El cliente ya tiene su captura de la boleta.
create or replace function public.vencer_garantias()
returns int as $$
declare
  v_total int;
begin
  with vencidos as (
    update public.order_items
       set account_email = null,
           account_password = null,
           console_code = null
     where completed_at is not null
       and account_email is not null
       and completed_at < now() - (coalesce(dias_garantia, 7) || ' days')::interval
    returning 1
  )
  select count(*) into v_total from vencidos;
  return v_total;
end;
$$ language plpgsql security definer;
