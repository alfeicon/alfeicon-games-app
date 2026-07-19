-- Tickets de "visto" para el chat de soporte.
--
-- Agrega a `order_messages`:
--   read_at : cuándo la contraparte vio el mensaje (null = aún no lo ve)
--
-- Quien lee marca los mensajes del otro: el admin marca los del cliente al
-- abrir la ventana de chat, y el cliente marca los del admin al abrir su
-- burbuja. Mantiene la misma postura RLS abierta del resto del proyecto.
--
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table public.order_messages add column if not exists read_at timestamptz;

-- El UPDATE necesita su propia policy: las de order-messages.sql solo cubren
-- select e insert, así que sin esto marcar como leído fallaría en silencio.
drop policy if exists "Público puede marcar leídos" on public.order_messages;
create policy "Público puede marcar leídos"
on public.order_messages for update
using (true)
with check (true);
