-- Fase 2 — Pago por transferencia con comprobante y aprobación del admin.
--
-- Agrega a `orders`:
--   payment_method : 'transferencia' | 'mercadopago' | null (null = flujo viejo)
--   payment_status : 'pending' | 'approved' | 'rejected' | ... | null
--   receipt_url    : URL pública de la foto del comprobante subido por el cliente
--
-- Y un bucket de Storage `comprobantes` (público, con nombres impredecibles:
-- <short_code>-<timestamp>.<ext>) para las fotos. Mantiene la misma postura RLS
-- abierta que ya usan `orders` y `order_messages` en este proyecto.
--
-- Ejecutar una vez en el SQL Editor de Supabase.

-- 1) Columnas (idempotente; si ya corriste orders-mercadopago.sql, solo agrega receipt_url)
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_status text;
alter table public.orders add column if not exists receipt_url text;

-- 2) Bucket de Storage para los comprobantes
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;

-- 3) Policies del bucket (subir y leer). Mismo enfoque abierto del resto del app.
drop policy if exists "Público sube comprobantes" on storage.objects;
create policy "Público sube comprobantes"
on storage.objects for insert
with check (bucket_id = 'comprobantes');

drop policy if exists "Público lee comprobantes" on storage.objects;
create policy "Público lee comprobantes"
on storage.objects for select
using (bucket_id = 'comprobantes');
