-- Sugerencias de precio: nunca cambian el catálogo automáticamente.
-- Ejecutar una vez en Supabase SQL Editor.

create table if not exists public.price_change_suggestions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  game_title text not null,
  current_price numeric not null,
  suggested_price numeric not null,
  observed_cost numeric not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  detected_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);

create unique index if not exists price_change_suggestions_one_pending_game_idx
  on public.price_change_suggestions (game_id)
  where status = 'pending';

create index if not exists price_change_suggestions_pending_idx
  on public.price_change_suggestions (status, detected_at desc);

alter table public.price_change_suggestions enable row level security;

drop policy if exists "price suggestions: admin read" on public.price_change_suggestions;
create policy "price suggestions: admin read"
  on public.price_change_suggestions for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "price suggestions: admin update" on public.price_change_suggestions;
create policy "price suggestions: admin update"
  on public.price_change_suggestions for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- El trigger solo propone. Se ejecuta con permisos del propietario para poder
-- guardar la sugerencia aunque el costo se complete desde una orden.
create or replace function public.check_recurring_cost_and_update_price()
returns trigger
language plpgsql
security definer
set search_path = public
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
  v_suggested_price integer;
begin
  if new.item_type <> 'game' or new.kind <> 'compra' or new.item_id is null then
    return new;
  end if;

  -- Cero es el valor temporal de una orden nueva, no un costo real.
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

  if array_length(v_recent_costs, 1) <> 5
     or v_recent_costs[1] <> v_recent_costs[2]
     or v_recent_costs[2] <> v_recent_costs[3]
     or v_recent_costs[3] <> v_recent_costs[4]
     or v_recent_costs[4] <> v_recent_costs[5] then
    return new;
  end if;

  v_new_cost := v_recent_costs[1];
  select price, cost_price, eshop_price
  into v_current_price, v_current_cost, v_eshop_price
  from public.games
  where id = v_game_id;

  if v_current_cost is not distinct from v_new_cost then
    return new;
  end if;

  v_price_marketing := coalesce(v_eshop_price * 0.47, 0);
  v_price_margin := (v_new_cost + 9000) / 0.965;
  v_suggested_price := greatest(
    round(greatest(v_price_margin, v_price_marketing) / 1000) * 1000 - 10,
    990
  );

  -- Una sugerencia pendiente por juego; las nuevas señales solo actualizan la
  -- recomendación. El precio del catálogo no se toca aquí.
  if v_current_price is distinct from v_suggested_price then
    insert into public.price_change_suggestions (
      game_id, game_title, current_price, suggested_price, observed_cost
    )
    select id, title, v_current_price, v_suggested_price, v_new_cost
    from public.games where id = v_game_id
    on conflict (game_id) where status = 'pending' do update
      set current_price = excluded.current_price,
          suggested_price = excluded.suggested_price,
          observed_cost = excluded.observed_cost,
          detected_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_check_recurring_cost on public.order_items;
create trigger trigger_check_recurring_cost
after insert or update of cost_price on public.order_items
for each row execute function public.check_recurring_cost_and_update_price();

create or replace function public.resolve_price_change_suggestion(
  p_suggestion_id uuid,
  p_accept boolean
)
returns public.price_change_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion public.price_change_suggestions;
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_suggestion
  from public.price_change_suggestions
  where id = p_suggestion_id and status = 'pending'
  for update;

  if not found then
    raise exception 'La sugerencia ya fue resuelta o no existe';
  end if;

  if p_accept then
    update public.games
    set price = v_suggestion.suggested_price, updated_at = now()
    where id = v_suggestion.game_id;
  end if;

  update public.price_change_suggestions
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decided_at = now(),
      decided_by = auth.uid()
  where id = v_suggestion.id
  returning * into v_suggestion;

  return v_suggestion;
end;
$$;

revoke all on function public.resolve_price_change_suggestion(uuid, boolean) from public, anon;
grant execute on function public.resolve_price_change_suggestion(uuid, boolean) to authenticated;

-- Permite que el panel reciba la sugerencia sin recargar.
alter publication supabase_realtime add table public.price_change_suggestions;
