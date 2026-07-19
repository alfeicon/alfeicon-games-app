-- Consultas de soporte enviadas desde la tienda (sección Soporte).
--
-- A diferencia de order_messages, acá no hay una orden detrás: es gente que
-- todavía no compra y está preguntando. Se responde por WhatsApp, así que se
-- guarda el contacto que la persona misma entrega.
--
--   name    : cómo se llama (texto libre)
--   contact : su WhatsApp o correo, para poder responderle
--   message : la consulta
--   status  : 'nueva' | 'atendida'
--
-- Ejecutar una vez en el SQL Editor de Supabase.

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  message text not null,
  status text not null default 'nueva' check (status in ('nueva', 'atendida')),
  created_at timestamptz not null default now()
);

create index if not exists support_requests_status_idx
  on public.support_requests (status, created_at desc);

alter table public.support_requests enable row level security;

-- Cualquiera puede enviar una consulta desde la tienda.
drop policy if exists "Público envía consultas" on public.support_requests;
create policy "Público envía consultas"
on public.support_requests for insert
with check (true);

-- Misma postura abierta del resto del proyecto para leer y marcar atendida.
-- OJO: acá sí hay datos de contacto de terceros, así que si algún día se
-- endurece el RLS del proyecto, esta tabla es la primera que hay que cerrar.
drop policy if exists "Público lee consultas" on public.support_requests;
create policy "Público lee consultas"
on public.support_requests for select
using (true);

drop policy if exists "Público actualiza consultas" on public.support_requests;
create policy "Público actualiza consultas"
on public.support_requests for update
using (true) with check (true);
