-- Telegram bot support for pack uploads.
-- Run once in the Supabase SQL Editor before using the Telegram bot with Supabase.

alter table public.packs
add column if not exists bot_pack_number integer unique,
add column if not exists source_message text,
add column if not exists source_hash text unique;

create index if not exists packs_bot_pack_number_idx on public.packs (bot_pack_number);
create index if not exists packs_source_hash_idx on public.packs (source_hash);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,
  item_detail text not null,
  sale_price integer not null check (sale_price >= 0),
  cost integer not null default 0 check (cost >= 0),
  profit integer not null default 0,
  provider text,
  platform text,
  customer text,
  console text,
  pack_number integer,
  created_at timestamptz not null default now()
);

create index if not exists sales_created_at_idx on public.sales (created_at desc);
create index if not exists sales_provider_idx on public.sales (provider);
create index if not exists sales_platform_idx on public.sales (platform);
create index if not exists sales_customer_idx on public.sales (customer);
