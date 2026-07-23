-- Momento en que el cliente confirmó la entrega. Es el inicio de la garantía
-- (7 días juegos unitarios, 3 días packs) y, con eso, hasta cuándo sigue
-- abierto su enlace /entrega/[codigo].
alter table public.orders
  add column if not exists completed_at timestamptz;

-- Órdenes ya completadas antes de esta columna: se asume la fecha de creación,
-- que para ellas es prácticamente el mismo día de la entrega.
update public.orders
  set completed_at = created_at
  where status = 'completed' and completed_at is null;
