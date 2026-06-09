-- Clears the public catalog.
-- Run this in Supabase SQL Editor if products or packs were duplicated.

begin;

truncate table public.pack_items, public.packs, public.games restart identity cascade;

commit;
