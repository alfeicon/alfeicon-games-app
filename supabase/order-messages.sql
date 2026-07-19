-- Chat de soporte entre el cliente (durante la instalación) y el admin,
-- ligado a una orden. El cliente nunca inicia sesión: sigue accediendo solo
-- por el short_code impredecible de su orden (igual que hoy con `orders`),
-- así que esta tabla mantiene la misma postura de RLS abierta que ya tiene
-- `orders` en este proyecto — no se endurece a un estándar distinto del
-- resto de la app.
--
-- Ejecutar una vez en el SQL Editor de Supabase.

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_messages_order_id_idx on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;

drop policy if exists "Público puede leer mensajes" on public.order_messages;
create policy "Público puede leer mensajes"
on public.order_messages for select
using (true);

drop policy if exists "Público puede insertar mensajes" on public.order_messages;
create policy "Público puede insertar mensajes"
on public.order_messages for insert
with check (true);

-- Realtime: mismo patrón que ya se usó para `orders`.
alter table public.order_messages replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end $$;
