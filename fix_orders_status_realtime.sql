-- ============================================================================
-- Alfeicon Games — Arreglo de ENTREGAS (tabla public.orders)
-- ============================================================================
-- Soluciona 2 cosas:
--   1) El botón "Avisar" no funciona porque el CHECK de `status` no permite
--      el valor 'preparing' (ni 'issue'). El UPDATE fallaba con:
--        23514: new row ... violates check constraint "orders_status_check"
--   2) No llegan notificaciones en tiempo real (admin ni cliente) porque la
--      tabla no está publicada en realtime / no tiene replica identity full.
--
-- Cómo aplicar: Supabase → SQL Editor → pega TODO → Run. Es idempotente.
-- ============================================================================

-- ── 1) CHECK de status: permitir los 5 estados que usa la app ──────────────
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'pending_console_code',
    'pending_setup',
    'preparing',
    'ready',
    'completed',
    'issue'
  ));

-- ── 2) Políticas RLS (idempotente) ─────────────────────────────────────────
alter table public.orders enable row level security;

drop policy if exists "Lectura pública de órdenes" on public.orders;
drop policy if exists "Escritura pública de órdenes" on public.orders;
drop policy if exists "Insertar órdenes públicas" on public.orders;
drop policy if exists "Eliminar órdenes públicas" on public.orders;

create policy "Lectura pública de órdenes"   on public.orders for select using (true);
create policy "Escritura pública de órdenes" on public.orders for update using (true) with check (true);
create policy "Insertar órdenes públicas"    on public.orders for insert with check (true);
create policy "Eliminar órdenes públicas"    on public.orders for delete using (true);

-- ── 3) Realtime: publicar la tabla y enviar la fila completa en cada cambio ─
-- replica identity full => payload.old trae todas las columnas (el admin lo usa
-- para detectar cuándo llegó el console_code).
alter table public.orders replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
