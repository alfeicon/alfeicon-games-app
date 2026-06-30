-- ============================================================================
-- Alfeicon Games — Row Level Security (RLS)
-- ============================================================================
-- Esquema real (public): admin_users, games, packs, pack_items, sales.
--
-- Modelo de acceso:
--   * games / packs  -> lectura pública SOLO de filas publicadas (is_active=true);
--                       admin lee todo y escribe todo.
--   * pack_items     -> lectura pública (se lee vía join); admin escribe.
--   * sales          -> SOLO admin (lee/escribe). Contiene cost/profit/customer:
--                       NUNCA debe ser legible por el público.
--   * admin_users    -> RLS activado; solo lectura para el propio admin.
--
-- La anon key es PÚBLICA (va en el bundle JS), así que RLS es lo único que
-- impide que un tercero edite precios, borre el catálogo o lea tus ventas.
--
-- NOTA sobre el bot: si tu bot escribe en `sales`/`games`/`packs` desde el
-- servidor con la SERVICE_ROLE key, RLS NO le afecta (la service_role bypassa
-- RLS), así que estas policies no lo rompen. Si tu bot usara la anon key,
-- avísame: habría que darle un rol/policy específico.
--
-- Cómo aplicar: pega todo este archivo en Supabase → SQL Editor → Run.
-- Es idempotente (se puede correr varias veces).
-- ============================================================================

-- ── 1) Helper: ¿el usuario actual es admin? ────────────────────────────────
-- Usa la tabla existente admin_users (user_id = auth.uid()).
-- security definer => puede leer admin_users saltándose su RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── 2) admin_users (protegida; lectura solo del propio admin) ──────────────
alter table public.admin_users enable row level security;

drop policy if exists "admin_users: read self" on public.admin_users;
create policy "admin_users: read self"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());
-- Sin policy de escritura: solo el SQL editor / service_role puede gestionar admins.

-- ── 3) GAMES ───────────────────────────────────────────────────────────────
alter table public.games enable row level security;

drop policy if exists "games: public read active" on public.games;
create policy "games: public read active"
  on public.games for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "games: admin write" on public.games;
create policy "games: admin write"
  on public.games for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 4) PACKS ─────────────────────────────────────────────────────────────--
alter table public.packs enable row level security;

drop policy if exists "packs: public read active" on public.packs;
create policy "packs: public read active"
  on public.packs for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "packs: admin write" on public.packs;
create policy "packs: admin write"
  on public.packs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 5) PACK_ITEMS (se lee vía join; títulos no sensibles) ──────────────────
alter table public.pack_items enable row level security;

drop policy if exists "pack_items: public read" on public.pack_items;
create policy "pack_items: public read"
  on public.pack_items for select
  to anon, authenticated
  using (true);

drop policy if exists "pack_items: admin write" on public.pack_items;
create policy "pack_items: admin write"
  on public.pack_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 6) SALES (SOLO admin — datos sensibles) ────────────────────────────────
alter table public.sales enable row level security;

drop policy if exists "sales: admin only" on public.sales;
create policy "sales: admin only"
  on public.sales for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- Sin policy para anon => el público no puede leer ni escribir ventas.

-- ── 7) Verifica que tu admin esté registrado ───────────────────────────────
-- Debe devolver tu fila (tu usuario). Si está vacío, tu panel no podrá escribir.
--   select * from public.admin_users;
--
-- Si faltara, regístralo (el usuario debe existir en auth.users):
--   insert into public.admin_users (user_id, email)
--   select id, email from auth.users where email = 'tu-admin@correo.com'
--   on conflict (user_id) do nothing;

-- ── 8) (Recomendado) Cierra el registro abierto ────────────────────────────
-- Authentication → Providers → Email → desactiva "Allow new users to sign up".
