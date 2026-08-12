-- Corrige el trigger de costos recurrentes.
-- El error anterior comparaba item_id (UUID) con texto y abortaba las órdenes
-- nuevas: operator does not exist: uuid = text.
create or replace function public.check_recurring_cost_and_update_price()
returns trigger
language plpgsql
as $$
declare
  v_game_id uuid;
  v_recent_costs integer[];
  v_new_cost integer;
  v_current_cost integer;
  v_eshop_price integer;
  v_price_marketing numeric;
  v_price_margin numeric;
  v_final_price integer;
begin
  if new.item_type <> 'game' or new.kind <> 'compra' or new.item_id is null then
    return new;
  end if;

  v_game_id := new.item_id::uuid;

  select array_agg(cost_price order by created_at desc)
  into v_recent_costs
  from (
    select cost_price, created_at
    from public.order_items
    where item_id = v_game_id
      and item_type = 'game'
      and kind = 'compra'
    order by created_at desc
    limit 5
  ) recent;

  if array_length(v_recent_costs, 1) = 5
     and v_recent_costs[1] = v_recent_costs[2]
     and v_recent_costs[2] = v_recent_costs[3]
     and v_recent_costs[3] = v_recent_costs[4]
     and v_recent_costs[4] = v_recent_costs[5] then
    v_new_cost := v_recent_costs[1];

    select cost_price, eshop_price
    into v_current_cost, v_eshop_price
    from public.games
    where id = v_game_id;

    if v_current_cost is distinct from v_new_cost then
      v_price_marketing := coalesce(v_eshop_price * 0.47, 0);
      v_price_margin := (v_new_cost + 9000) / 0.965;
      v_final_price := round(greatest(v_price_margin, v_price_marketing) / 1000) * 1000 - 10;
      v_final_price := greatest(v_final_price, 990);

      update public.games
      set cost_price = v_new_cost, price = v_final_price, updated_at = now()
      where id = v_game_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_check_recurring_cost on public.order_items;
create trigger trigger_check_recurring_cost
after insert on public.order_items
for each row execute function public.check_recurring_cost_and_update_price();
