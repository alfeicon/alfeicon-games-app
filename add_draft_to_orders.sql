-- Permitir el estado 'draft' en la tabla orders
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'draft',
    'pending_console_code',
    'pending_setup',
    'preparing',
    'ready',
    'completed',
    'issue'
  ));
