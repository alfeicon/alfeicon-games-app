-- Guardas contra duplicados de entregas/pagos.
--
-- Ejecutar en Supabase SQL Editor. Este archivo NO borra registros: si ya hay
-- duplicados, deja NOTICE y no crea el índice correspondiente hasta que los
-- revises. Así evita romper datos históricos a ciegas.

-- 0) Columnas usadas por el flujo de pagos. Si todavía no corriste las
-- migraciones de Mercado Pago/comprobantes, se crean aquí para que el script
-- completo pueda ejecutarse sin fallar.
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_status text;
alter table public.orders add column if not exists receipt_url text;
alter table public.orders add column if not exists mp_preference_id text;
alter table public.orders add column if not exists mp_payment_id text;

-- 1) Diagnóstico rápido: estas consultas muestran si ya hay valores repetidos.
select short_code, count(*) as ordenes, array_agg(id order by created_at desc) as ids
from public.orders
where short_code is not null
group by short_code
having count(*) > 1;

select mp_payment_id, count(*) as ordenes, array_agg(id order by created_at desc) as ids
from public.orders
where mp_payment_id is not null
group by mp_payment_id
having count(*) > 1;

select mp_preference_id, count(*) as ordenes, array_agg(id order by created_at desc) as ids
from public.orders
where mp_preference_id is not null
group by mp_preference_id
having count(*) > 1;

-- 2) Índices únicos defensivos. Se crean solo cuando la columna no tiene
-- duplicados actualmente.
do $$
begin
  if not exists (
    select 1
    from public.orders
    where short_code is not null
    group by short_code
    having count(*) > 1
  ) then
    create unique index if not exists orders_short_code_unique_idx
      on public.orders (short_code)
      where short_code is not null;
  else
    raise notice 'No se creó orders_short_code_unique_idx: hay short_code duplicados.';
  end if;

  if not exists (
    select 1
    from public.orders
    where mp_payment_id is not null
    group by mp_payment_id
    having count(*) > 1
  ) then
    create unique index if not exists orders_mp_payment_id_unique_idx
      on public.orders (mp_payment_id)
      where mp_payment_id is not null;
  else
    raise notice 'No se creó orders_mp_payment_id_unique_idx: hay mp_payment_id duplicados.';
  end if;

  if not exists (
    select 1
    from public.orders
    where mp_preference_id is not null
    group by mp_preference_id
    having count(*) > 1
  ) then
    create unique index if not exists orders_mp_preference_id_unique_idx
      on public.orders (mp_preference_id)
      where mp_preference_id is not null;
  else
    raise notice 'No se creó orders_mp_preference_id_unique_idx: hay mp_preference_id duplicados.';
  end if;
end $$;

-- 3) Consulta útil para limpiar manualmente ruido de Mercado Pago:
-- intentos creados hace más de 24 horas, nunca aprobados y sin comprobante.
select id, order_number, short_code, game_name, sale_price, created_at, mp_preference_id
from public.orders
where status = 'draft'
  and payment_method = 'mercadopago'
  and payment_status = 'pending'
  and receipt_url is null
  and created_at < now() - interval '24 hours'
order by created_at desc;
