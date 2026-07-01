-- Alfeicon Games — tabla de Noticias/Promociones
-- Pega esto en Supabase → SQL Editor → Run. Es idempotente y autosuficiente
-- (no depende de que schema.sql se haya corrido antes en este proyecto).

create extension if not exists pgcrypto;

-- Redefine estas dos funciones por si este proyecto no las tiene aún
-- (son las mismas de schema.sql / rls-policies.sql; recrearlas es inofensivo).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_active_order_idx
  on public.news (is_active, sort_order, created_at desc);

drop trigger if exists set_news_updated_at on public.news;
create trigger set_news_updated_at
before update on public.news
for each row execute function public.set_updated_at();

alter table public.news enable row level security;

-- Lectura pública solo de noticias activas; el admin ve todo.
drop policy if exists "news: public read active" on public.news;
create policy "news: public read active"
  on public.news for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

-- Solo el admin puede crear/editar/borrar noticias.
drop policy if exists "news: admin write" on public.news;
create policy "news: admin write"
  on public.news for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
