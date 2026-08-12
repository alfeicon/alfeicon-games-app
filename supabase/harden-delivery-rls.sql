-- Alfeicon Games — cerrar acceso público a entregas
--
-- Ejecutar DESPUÉS de publicar y probar la API /api/entrega/[codigo].
-- El portal del cliente ya no consulta orders/order_items/order_messages con la
-- clave anon: esas consultas pasan por el servidor y service_role.
-- El bot de Apps Script tampoco se rompe: usa service_role y bypassa RLS.

-- ORDERS: el cliente solo puede crear el borrador inicial. Leer, editar y
-- borrar queda reservado al admin o a las rutas del servidor.
alter table public.orders enable row level security;
drop policy if exists "Lectura pública de órdenes" on public.orders;
drop policy if exists "Escritura pública de órdenes" on public.orders;
drop policy if exists "Insertar órdenes públicas" on public.orders;
drop policy if exists "Eliminar órdenes públicas" on public.orders;
drop policy if exists "orders: public read" on public.orders;
drop policy if exists "orders: public write" on public.orders;

create policy "orders: admin read" on public.orders
  for select to authenticated using (public.is_admin());
create policy "orders: admin write" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "orders: create draft" on public.orders
  for insert to anon, authenticated
  with check (status = 'draft' and (payment_status is null or payment_status = 'pending'));

-- ORDER_ITEMS: se pueden crear solo para una orden draft; luego solo el admin
-- o el servidor puede leer/modificar las credenciales.
alter table public.order_items enable row level security;
drop policy if exists "Lectura pública de ítems" on public.order_items;
drop policy if exists "Escritura pública de ítems" on public.order_items;
drop policy if exists "Insertar ítems públicos" on public.order_items;
drop policy if exists "Eliminar ítems públicos" on public.order_items;

create policy "order_items: admin read" on public.order_items
  for select to authenticated using (public.is_admin());
create policy "order_items: admin write" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "order_items: create for draft" on public.order_items
  for insert to anon, authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.status = 'draft'
  ));

-- ORDER_MESSAGES: el cliente usa la API; solo el admin accede directamente.
alter table public.order_messages enable row level security;
drop policy if exists "Público puede leer mensajes" on public.order_messages;
drop policy if exists "Público puede insertar mensajes" on public.order_messages;
drop policy if exists "Público puede marcar leídos" on public.order_messages;

create policy "order_messages: admin read" on public.order_messages
  for select to authenticated using (public.is_admin());
create policy "order_messages: admin write" on public.order_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- CONSULTAS DE SOPORTE: cualquiera puede crear una consulta, pero solo el
-- admin puede leer o cambiar los datos de contacto.
alter table public.support_requests enable row level security;
drop policy if exists "Público lee consultas" on public.support_requests;
drop policy if exists "Público actualiza consultas" on public.support_requests;
create policy "support: admin read" on public.support_requests
  for select to authenticated using (public.is_admin());
create policy "support: admin write" on public.support_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "support: admin delete" on public.support_requests
  for delete to authenticated using (public.is_admin());

-- CÓDIGOS DE DESCUENTO: se validan mediante la función security definer; no
-- hace falta que el navegador pueda listar o editar los códigos.
alter table public.discount_codes enable row level security;
drop policy if exists "Lectura pública de códigos" on public.discount_codes;
drop policy if exists "Escritura pública de códigos" on public.discount_codes;
drop policy if exists "Insertar códigos" on public.discount_codes;
drop policy if exists "Eliminar códigos" on public.discount_codes;
create policy "discount_codes: admin only" on public.discount_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
