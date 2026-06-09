-- App settings for editable storefront prices.
-- Run this once in Supabase SQL Editor.

create table if not exists public.app_settings (
  key text primary key,
  value integer not null check (value >= 0),
  label text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value, label)
values
  ('nintendo_online_price', 25500, 'Nintendo Switch Online + Expansion Pack 12 meses'),
  ('pack_price_increase', 15000, 'Aumento automatico para packs del bot')
on conflict (key) do nothing;

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists "Public can read app settings" on public.app_settings;
create policy "Public can read app settings"
on public.app_settings for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage app settings" on public.app_settings;
create policy "Admins can manage app settings"
on public.app_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
