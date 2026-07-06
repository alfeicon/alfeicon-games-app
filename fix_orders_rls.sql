-- Borrar políticas anteriores por si acaso
drop policy if exists "Lectura pública de órdenes" on public.orders;
drop policy if exists "Escritura pública de órdenes" on public.orders;
drop policy if exists "Insertar órdenes públicas" on public.orders;
drop policy if exists "Eliminar órdenes públicas" on public.orders;

-- Volver a crear todas las políticas completas
create policy "Lectura pública de órdenes" on public.orders for select using (true);
create policy "Escritura pública de órdenes" on public.orders for update using (true);
create policy "Insertar órdenes públicas" on public.orders for insert with check (true);
create policy "Eliminar órdenes públicas" on public.orders for delete using (true);
