-- Finanzas: conservar el método real de pago en sales.
--
-- La app descuenta la comisión de Mercado Pago en la interfaz usando
-- sales.payment_method. Para que las ventas creadas automáticamente desde
-- Entregas no queden como "Transferencia", este trigger copia el método real
-- desde orders.payment_method al momento de completar la orden.

alter table public.orders add column if not exists payment_method text;
alter table public.sales add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.sales add column if not exists partner_pct integer check (partner_pct is null or (partner_pct between 0 and 100));
create index if not exists sales_order_id_idx on public.sales (order_id);

create or replace function public.costo_total_orden(p_order_id uuid)
returns numeric as $$
  select coalesce(sum(cost_price), 0) from public.order_items where order_id = p_order_id;
$$ language sql stable;

create or replace function public.create_sale_on_order_completed()
returns trigger as $$
declare
  v_costo numeric;
  v_payment_method text;
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    if NEW.sale_price is not null then
      v_costo := public.costo_total_orden(NEW.id);
      if v_costo = 0 then v_costo := coalesce(NEW.cost_price, 0); end if;

      v_payment_method := case NEW.payment_method
        when 'mercadopago' then 'Mercado Pago'
        when 'transferencia' then 'Transferencia'
        when 'global66' then 'Global66'
        when 'prex' then 'Prex'
        when 'binance' then 'Binance'
        else 'Transferencia'
      end;

      insert into public.sales (
        item_type, item_title, price_sold, cost_price,
        payment_method, provider, partner_pct, order_id, created_at
      ) values (
        case when coalesce(array_length(NEW.pack_ids, 1), 0) > 0 then 'pack' else 'game' end,
        NEW.game_name,
        NEW.sale_price,
        v_costo,
        v_payment_method,
        NEW.provider,
        NEW.partner_pct,
        NEW.id,
        now()
      );
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists create_sale_on_order_completed_trigger on public.orders;
drop trigger if exists trg_create_sale_on_order_completed on public.orders;
drop trigger if exists trigger_create_sale_on_order_completed on public.orders;
create trigger create_sale_on_order_completed_trigger
after update on public.orders
for each row
execute function public.create_sale_on_order_completed();

-- Backfill seguro: solo ventas que ya están vinculadas a una orden.
update public.sales s
set payment_method = case o.payment_method
  when 'mercadopago' then 'Mercado Pago'
  when 'transferencia' then 'Transferencia'
  when 'global66' then 'Global66'
  when 'prex' then 'Prex'
  when 'binance' then 'Binance'
  else s.payment_method
end
from public.orders o
where s.order_id = o.id
  and o.payment_method is not null;
