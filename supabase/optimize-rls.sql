-- Alfeicon Games — Optimización de políticas RLS
-- Envuelve public.is_admin() en (select ...) para que Postgres lo evalúe UNA vez
-- por consulta (initPlan) en lugar de re-ejecutarlo fila por fila.
-- Ver: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices
-- Es idempotente: puedes correrlo en Supabase → SQL Editor → Run.

-- ── games ──────────────────────────────────────────────────────────────────
drop policy if exists "Public can read active games" on public.games;
create policy "Public can read active games"
on public.games for select
to anon, authenticated
using (is_active = true or (select public.is_admin()));

drop policy if exists "Admins can manage games" on public.games;
create policy "Admins can manage games"
on public.games for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- ── packs ──────────────────────────────────────────────────────────────────
drop policy if exists "Public can read active packs" on public.packs;
create policy "Public can read active packs"
on public.packs for select
to anon, authenticated
using (is_active = true or (select public.is_admin()));

drop policy if exists "Admins can manage packs" on public.packs;
create policy "Admins can manage packs"
on public.packs for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- ── pack_items ─────────────────────────────────────────────────────────────
drop policy if exists "Public can read active pack items" on public.pack_items;
create policy "Public can read active pack items"
on public.pack_items for select
to anon, authenticated
using (
  exists (
    select 1
    from public.packs
    where packs.id = pack_items.pack_id
      and (packs.is_active = true or (select public.is_admin()))
  )
);

drop policy if exists "Admins can manage pack items" on public.pack_items;
create policy "Admins can manage pack items"
on public.pack_items for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- ── news ───────────────────────────────────────────────────────────────────
drop policy if exists "news: public read active" on public.news;
create policy "news: public read active"
on public.news for select
to anon, authenticated
using (is_active = true or (select public.is_admin()));

drop policy if exists "news: admin write" on public.news;
create policy "news: admin write"
on public.news for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- ── admin_users ────────────────────────────────────────────────────────────
drop policy if exists "Admins can read admins" on public.admin_users;
create policy "Admins can read admins"
on public.admin_users for select
to authenticated
using ((select public.is_admin()));
