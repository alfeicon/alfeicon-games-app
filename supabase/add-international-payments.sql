alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method is null or payment_method in ('transferencia', 'mercadopago', 'global66', 'prex', 'binance'));
