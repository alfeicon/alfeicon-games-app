-- SQL Script: Create Profiles Table
-- Run this in your Supabase SQL Editor

-- 1. Create the table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  alias text,
  birth_date date,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. Create RLS Policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" 
on public.profiles for select 
to authenticated 
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" 
on public.profiles for update 
to authenticated 
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" 
on public.profiles for insert 
to authenticated 
with check (auth.uid() = id);

-- 4. Create trigger to automatically insert a row when a user registers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
