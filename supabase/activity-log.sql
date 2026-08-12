-- Activity log for catalog/admin changes.
-- Run this in Supabase SQL Editor. It is idempotent.

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid,
  entity_title text,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_fields text[] not null default '{}',
  old_values jsonb,
  new_values jsonb,
  reason text,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
create index if not exists activity_log_entity_idx on public.activity_log (entity_table, entity_id, created_at desc);

create or replace function public.changed_column_names(old_row jsonb, new_row jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(key order by key), '{}')
  from (
    select coalesce(o.key, n.key) as key
    from jsonb_each(old_row) o
    full join jsonb_each(new_row) n using (key)
    where o.value is distinct from n.value
      and coalesce(o.key, n.key) not in ('updated_at')
  ) diff;
$$;

create or replace function public.activity_reason(
  entity_table text,
  action text,
  changed_fields text[],
  actor uuid
)
returns text
language plpgsql
stable
as $$
begin
  if action = 'insert' then
    return 'Registro creado';
  end if;

  if action = 'delete' then
    if entity_table = 'orders' then
      return 'Orden eliminada: snapshot guardado para auditoria';
    end if;
    if entity_table = 'order_items' then
      return 'Item de orden eliminado: snapshot guardado para auditoria';
    end if;
    return 'Registro eliminado';
  end if;

  if 'price' = any(changed_fields) then
    if actor is null then
      return 'Precio actualizado por automatizacion, API privada o service role';
    end if;
    return 'Precio actualizado desde una sesion admin';
  end if;

  if 'offer_price' = any(changed_fields) or 'is_offer' = any(changed_fields) then
    return 'Oferta actualizada';
  end if;

  if 'is_active' = any(changed_fields) then
    return 'Visibilidad del catalogo actualizada';
  end if;

  if entity_table = 'app_settings' then
    return 'Ajuste global actualizado';
  end if;

  if entity_table = 'orders' then
    return 'Orden actualizada';
  end if;

  if entity_table = 'order_items' then
    return 'Item de orden actualizado';
  end if;

  return 'Campos actualizados: ' || array_to_string(changed_fields, ', ');
end;
$$;

create or replace function public.redact_activity_values(data jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when data is null then null
    else data
      - 'account_password'
      - 'account_email'
      - 'console_code'
      - 'client_email'
      - 'client_name'
      - 'receipt_url'
      - 'mp_payment_id'
  end;
$$;

create or replace function public.log_catalog_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_data jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_data jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  fields text[];
  actor uuid := auth.uid();
  entity_uuid uuid;
  entity_name text;
  action_name text := lower(tg_op);
begin
  fields := case
    when tg_op = 'UPDATE' then public.changed_column_names(old_data, new_data)
    when tg_op = 'INSERT' then array['created']
    else array['deleted']
  end;

  if tg_op = 'UPDATE' and coalesce(array_length(fields, 1), 0) = 0 then
    return new;
  end if;

  entity_uuid := case
    when tg_table_name in ('games', 'packs', 'orders', 'order_items') then coalesce((new_data->>'id')::uuid, (old_data->>'id')::uuid)
    else null
  end;

  entity_name := coalesce(
    new_data->>'title',
    old_data->>'title',
    new_data->>'game_name',
    old_data->>'game_name',
    new_data->>'short_code',
    old_data->>'short_code',
    new_data->>'key',
    old_data->>'key'
  );

  insert into public.activity_log (
    entity_table,
    entity_id,
    entity_title,
    action,
    changed_fields,
    old_values,
    new_values,
    reason,
    changed_by
  )
  values (
    tg_table_name,
    entity_uuid,
    entity_name,
    action_name,
    fields,
    case when tg_op in ('UPDATE', 'DELETE') then public.redact_activity_values(old_data) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then public.redact_activity_values(new_data) else null end,
    public.activity_reason(tg_table_name, action_name, fields, actor),
    actor
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists log_games_activity on public.games;
create trigger log_games_activity
after insert or update or delete on public.games
for each row execute function public.log_catalog_activity();

drop trigger if exists log_packs_activity on public.packs;
create trigger log_packs_activity
after insert or update or delete on public.packs
for each row execute function public.log_catalog_activity();

drop trigger if exists log_app_settings_activity on public.app_settings;
create trigger log_app_settings_activity
after insert or update or delete on public.app_settings
for each row execute function public.log_catalog_activity();

do $$
begin
  if to_regclass('public.orders') is not null then
    drop trigger if exists log_orders_activity on public.orders;
    create trigger log_orders_activity
    after insert or update or delete on public.orders
    for each row execute function public.log_catalog_activity();
  end if;

  if to_regclass('public.order_items') is not null then
    drop trigger if exists log_order_items_activity on public.order_items;
    create trigger log_order_items_activity
    after insert or update or delete on public.order_items
    for each row execute function public.log_catalog_activity();
  end if;
end $$;

alter table public.activity_log enable row level security;

drop policy if exists "activity_log: admin read" on public.activity_log;
create policy "activity_log: admin read"
  on public.activity_log for select
  to authenticated
  using (public.is_admin());

drop policy if exists "activity_log: admin delete" on public.activity_log;
create policy "activity_log: admin delete"
  on public.activity_log for delete
  to authenticated
  using (public.is_admin());

-- No public insert/update policies: writes happen through security-definer triggers.

-- Optional cleanup for logs created before redaction existed.
update public.activity_log
set
  old_values = public.redact_activity_values(old_values),
  new_values = public.redact_activity_values(new_values)
where entity_table in ('orders', 'order_items')
  and (
    old_values ?| array['account_password','account_email','console_code','client_email','client_name','receipt_url','mp_payment_id']
    or new_values ?| array['account_password','account_email','console_code','client_email','client_name','receipt_url','mp_payment_id']
  );
