-- Alfeicon Games - Supabase schema
-- Run this in the Supabase SQL Editor after creating your project.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price integer not null check (price >= 0),
  image_url text,
  description text,
  trailer_url text,
  storage_required text,
  is_offer boolean not null default false,
  offer_price integer check (offer_price is null or offer_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price integer not null check (price >= 0),
  image_url text,
  console text,
  is_new boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pack_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.packs(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists games_active_title_idx on public.games (is_active, title);
create index if not exists packs_active_created_idx on public.packs (is_active, created_at desc);
create index if not exists pack_items_pack_sort_idx on public.pack_items (pack_id, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_games_updated_at on public.games;
create trigger set_games_updated_at
before update on public.games
for each row execute function public.set_updated_at();

drop trigger if exists set_packs_updated_at on public.packs;
create trigger set_packs_updated_at
before update on public.packs
for each row execute function public.set_updated_at();

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

alter table public.admin_users enable row level security;
alter table public.games enable row level security;
alter table public.packs enable row level security;
alter table public.pack_items enable row level security;

drop policy if exists "Admins can read admins" on public.admin_users;
create policy "Admins can read admins"
on public.admin_users for select
to authenticated
using (public.is_admin());

drop policy if exists "Public can read active games" on public.games;
create policy "Public can read active games"
on public.games for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage games" on public.games;
create policy "Admins can manage games"
on public.games for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active packs" on public.packs;
create policy "Public can read active packs"
on public.packs for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage packs" on public.packs;
create policy "Admins can manage packs"
on public.packs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active pack items" on public.pack_items;
create policy "Public can read active pack items"
on public.pack_items for select
to anon, authenticated
using (
  exists (
    select 1
    from public.packs
    where packs.id = pack_items.pack_id
      and (packs.is_active = true or public.is_admin())
  )
);

drop policy if exists "Admins can manage pack items" on public.pack_items;
create policy "Admins can manage pack items"
on public.pack_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
