-- ============================================================================
-- Alfeicon Games — Row Level Security (RLS)
-- ============================================================================
-- Modelo de acceso:
--   * Lectura pública (anon): solo filas publicadas (is_active = true) de
--     games/packs, todos los pack_items y app_settings.
--   * Escritura: SOLO usuarios registrados en la tabla public.admins.
--
-- La anon key es PÚBLICA (va en el bundle JS), así que RLS es lo único que
-- impide que un tercero edite precios o borre el catálogo.
--
-- Cómo aplicar: pega todo este archivo en Supabase → SQL Editor → Run.
-- Es idempotente (se puede correr varias veces).
-- ============================================================================

-- ── 1) Registro de administradores ─────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Un admin solo puede verse a sí mismo; nadie más lee esta tabla.
drop policy if exists "admins: read self" on public.admins;
create policy "admins: read self"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- ── 2) Helper: ¿el usuario actual es admin? ────────────────────────────────
-- security definer => puede leer public.admins saltándose RLS sin filtrar.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

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

-- ── 6) APP_SETTINGS ─────────────────────────────────────────────────────--
alter table public.app_settings enable row level security;

drop policy if exists "app_settings: public read" on public.app_settings;
create policy "app_settings: public read"
  on public.app_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "app_settings: admin write" on public.app_settings;
create policy "app_settings: admin write"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 7) Registra tu usuario admin ───────────────────────────────────────────
-- El usuario debe haber iniciado sesión al menos una vez (existir en auth.users).
-- Reemplaza el correo y ejecuta:
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'tu-admin@correo.com'
-- on conflict (user_id) do nothing;

-- ── 8) (Opcional pero recomendado) Cierra el registro abierto ──────────────
-- En Supabase → Authentication → Providers → Email: desactiva "Allow new users
-- to sign up". Así nadie puede auto-registrarse aunque tuviera la anon key.
