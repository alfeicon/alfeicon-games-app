-- Clears the public catalog before running seed-from-sheets.sql again.
-- Run this in Supabase SQL Editor if products were duplicated.

begin;

truncate table public.pack_items, public.packs, public.games restart identity cascade;

commit;
