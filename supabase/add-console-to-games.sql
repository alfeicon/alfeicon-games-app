-- Add console compatibility to individual games.
-- Run once in the Supabase SQL Editor before marking games as "Solo Switch 2" in admin.

alter table public.games
add column if not exists console text not null default 'switch'
check (console in ('switch', 'switch2'));

update public.games
set console = 'switch'
where console is null;
