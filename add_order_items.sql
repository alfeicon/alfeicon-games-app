-- ORDEN MADRE + ÍTEMS
--
-- Hasta ahora la orden guardaba UNA cuenta (account_email/password). Eso solo
-- funciona si la compra es de un ítem: un pack y un juego son cuentas
-- distintas, y el cliente tiene que instalar cada una por su lado.
--
-- Desde aquí `orders` es la orden madre (cliente, pago, enlace) y cada cuenta
-- que se entrega es un renglón en `order_items`. Un pack entero = 1 renglón,
-- porque va todo en una sola cuenta.
--
-- Además permite colgar una recuperación (kind='recuperacion') de la misma
-- orden cuando se resuelve un ticket de garantía: el cliente la ve en su mismo
-- enlace y el costo extra baja la ganancia de esa venta.

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  -- 'compra'       → lo que el cliente pagó.
  -- 'recuperacion' → reposición por garantía. La primera va por cuenta de la
  --                  tienda (sale_price 0, cost_price el que corresponda).
  kind text not null default 'compra' check (kind in ('compra', 'recuperacion')),

  -- Define la garantía: 7 días 'game', 3 días 'pack'.
  item_type text not null check (item_type in ('game', 'pack')),
  -- Referencia suave al catálogo: si el juego se borra, el renglón sobrevive.
  item_id uuid,
  title text not null,

  sale_price numeric not null default 0,
  cost_price numeric not null default 0,
  provider text,

  -- La cuenta de ESTE ítem. Se vacía al vencer la garantía (cron /api/health).
  account_email text,
  account_password text,
  console_code text,

  -- Cuándo confirmó el cliente esta instalación. Inicio de su garantía.
  completed_at timestamptz,

  -- Orden en que se instalan ("Juego 1 de 2").
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- Mismas políticas abiertas que `orders`: el cliente lee y actualiza su propia
-- entrega con la clave anónima, identificándose por el short_code del enlace.
alter table public.order_items enable row level security;
drop policy if exists "Lectura pública de ítems" on public.order_items;
drop policy if exists "Escritura pública de ítems" on public.order_items;
drop policy if exists "Insertar ítems públicos" on public.order_items;
drop policy if exists "Eliminar ítems públicos" on public.order_items;
create policy "Lectura pública de ítems" on public.order_items for select using (true);
create policy "Escritura pública de ítems" on public.order_items for update using (true);
create policy "Insertar ítems públicos" on public.order_items for insert with check (true);
create policy "Eliminar ítems públicos" on public.order_items for delete using (true);


-- MIGRACIÓN
-- Todo lo vendido hasta hoy es de un solo ítem, así que cada orden se convierte
-- en un renglón. `pack_ids` con contenido = era un pack.
insert into public.order_items (
  order_id, kind, item_type, item_id, title,
  sale_price, cost_price, provider,
  account_email, account_password, console_code, completed_at, sort_order
)
select
  o.id,
  'compra',
  case when coalesce(array_length(o.pack_ids, 1), 0) > 0 then 'pack' else 'game' end,
  case when coalesce(array_length(o.pack_ids, 1), 0) > 0 then o.pack_ids[1] else null end,
  o.game_name,
  coalesce(o.sale_price, 0),
  coalesce(o.cost_price, 0),
  o.provider,
  o.account_email,
  o.account_password,
  o.console_code,
  o.completed_at,
  0
from public.orders o
where not exists (select 1 from public.order_items i where i.order_id = o.id);


-- GANANCIA
-- El costo de una venta pasa a ser la suma de los costos de sus ítems, para que
-- agregar una recuperación baje la ganancia de esa venta sin tocar nada más.
alter table public.sales add column if not exists order_id uuid references public.orders(id) on delete set null;
create index if not exists sales_order_id_idx on public.sales (order_id);

create or replace function public.costo_total_orden(p_order_id uuid)
returns numeric as $$
  select coalesce(sum(cost_price), 0) from public.order_items where order_id = p_order_id;
$$ language sql stable;

-- Reemplaza al trigger de auto_sales_trigger.sql: mismo momento (la orden pasa
-- a 'completed'), pero con el costo sumado desde los ítems y guardando el
-- order_id para poder recalcular después.
create or replace function public.create_sale_on_order_completed()
returns trigger as $$
declare
  v_costo numeric;
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    if NEW.sale_price is not null then
      -- Si la orden aún no tiene ítems (creada a mano en el admin), se cae al
      -- costo de la orden como antes.
      v_costo := public.costo_total_orden(NEW.id);
      if v_costo = 0 then v_costo := coalesce(NEW.cost_price, 0); end if;

      insert into public.sales (
        item_type, item_title, price_sold, cost_price,
        payment_method, provider, order_id, created_at
      ) values (
        case when coalesce(array_length(NEW.pack_ids, 1), 0) > 0 then 'pack' else 'game' end,
        NEW.game_name,
        NEW.sale_price,
        v_costo,
        'Transferencia',
        NEW.provider,
        NEW.id,
        now()
      );
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Agregar (o editar) una recuperación después de la venta reajusta su costo.
create or replace function public.recalcular_costo_venta()
returns trigger as $$
declare
  v_order_id uuid := coalesce(NEW.order_id, OLD.order_id);
begin
  update public.sales
     set cost_price = public.costo_total_orden(v_order_id)
   where order_id = v_order_id;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_recalcular_costo_venta on public.order_items;
create trigger trigger_recalcular_costo_venta
  after insert or update of cost_price or delete on public.order_items
  for each row execute function public.recalcular_costo_venta();
