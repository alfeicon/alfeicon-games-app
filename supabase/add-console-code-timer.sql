-- Guarda cuándo el cliente envió el último código de consola.
-- Permite que el portal reinicie la barra y mida una hora real por código.
alter table public.orders
  add column if not exists console_code_submitted_at timestamptz;

-- Para órdenes antiguas que ya tienen código, usamos la fecha de creación como
-- respaldo hasta que el cliente vuelva a enviar un código.
update public.orders
set console_code_submitted_at = created_at
where console_code is not null
  and console_code_submitted_at is null;
