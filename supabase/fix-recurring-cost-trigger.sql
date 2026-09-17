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
  v_current_price numeric;
  v_current_cost integer;
  v_eshop_price integer;
  v_price_marketing numeric;
  v_price_margin numeric;
  v_final_price integer;
begin
  if new.item_type <> 'game' or new.kind <> 'compra' or new.item_id is null then
    return new;
  end if;

  -- Una orden recién creada todavía no tiene costo: se inserta con 0 y el
  -- administrador lo completa al conseguir la cuenta. Cero no es un costo
  -- válido y, si se contara, cinco órdenes nuevas bajarían el precio a $8.990.
  if coalesce(new.cost_price, 0) <= 0 then
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
      and cost_price > 0
    order by created_at desc
    limit 5
  ) recent;

  if array_length(v_recent_costs, 1) = 5
     and v_recent_costs[1] = v_recent_costs[2]
     and v_recent_costs[2] = v_recent_costs[3]
     and v_recent_costs[3] = v_recent_costs[4]
     and v_recent_costs[4] = v_recent_costs[5] then
    v_new_cost := v_recent_costs[1];

    select price, cost_price, eshop_price
    into v_current_price, v_current_cost, v_eshop_price
    from public.games
    where id = v_game_id;

    if v_current_cost is distinct from v_new_cost then
      v_price_marketing := coalesce(v_eshop_price * 0.47, 0);
      v_price_margin := (v_new_cost + 9000) / 0.965;
      v_final_price := round(greatest(v_price_margin, v_price_marketing) / 1000) * 1000 - 10;
      v_final_price := greatest(v_final_price, 990);

      -- El precio no se cambia solo: se guarda una propuesta para que el
      -- administrador la acepte o la descarte en el panel.
      if v_current_price is distinct from v_final_price then
        insert into public.price_change_suggestions (
          game_id, game_title, current_price, suggested_price, observed_cost
        )
        select id, title, v_current_price, v_final_price, v_new_cost
        from public.games where id = v_game_id
        on conflict (game_id) where status = 'pending' do update
          set current_price = excluded.current_price,
              suggested_price = excluded.suggested_price,
              observed_cost = excluded.observed_cost,
              detected_at = now();
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_check_recurring_cost on public.order_items;
create trigger trigger_check_recurring_cost
after insert or update of cost_price on public.order_items
for each row execute function public.check_recurring_cost_and_update_price();
