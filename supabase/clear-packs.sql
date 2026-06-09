-- Borra todos los packs del catalogo, incluyendo packs antiguos o de prueba.
-- No borra juegos unitarios ni ventas.

begin;

delete from public.pack_items;
delete from public.packs;

commit;
