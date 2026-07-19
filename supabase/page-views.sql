-- Visitas de la tienda, para verlas dentro del admin.
--
-- Deliberadamente anónima: NO se guarda IP, cookie, user-agent ni nada que
-- identifique a la persona. Solo qué se vio, cuándo y (si Vercel lo informa)
-- desde qué país. Con eso alcanza para contar visitas y cruzarlas con ventas.
--
--   path      : ruta visitada ('/', '/juego/mario-kart', …)
--   item_id   : id del juego o pack, cuando la visita es a una ficha
--   item_type : 'game' | 'pack' | null
--   country   : código de 2 letras, o null
--   source    : de dónde llegó ('instagram', 'facebook', 'whatsapp', 'directo'…)
--
-- Ejecutar una vez en el SQL Editor de Supabase.

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  item_id uuid,
  item_type text check (item_type in ('game', 'pack')),
  country text,
  source text,
  created_at timestamptz not null default now()
);

-- Para instalaciones que crearon la tabla antes de que existiera `source`:
-- `create table if not exists` no agrega columnas a una tabla ya creada.
alter table public.page_views add column if not exists source text;

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_item_idx on public.page_views (item_id, created_at desc);
create index if not exists page_views_source_idx on public.page_views (source, created_at desc);

alter table public.page_views enable row level security;

-- Misma postura RLS abierta que el resto del proyecto: la tienda inserta y el
-- admin lee con la clave anónima. Como no hay dato personal, lo peor que
-- puede pasar es que alguien cuente visitas o inserte visitas falsas.
drop policy if exists "Público registra visitas" on public.page_views;
create policy "Público registra visitas"
on public.page_views for insert
with check (true);

drop policy if exists "Público lee visitas" on public.page_views;
create policy "Público lee visitas"
on public.page_views for select
using (true);
