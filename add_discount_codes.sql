-- CÓDIGOS DE DESCUENTO
--
-- Sirven para dos cosas: promociones abiertas (un código que reparte a todos) y
-- descuentos puntuales para un cliente, como el que se ofrece cuando ya usó su
-- garantía y quiere reponer el juego pagando menos.
--
-- El código se puede limitar a juegos, a packs o dejarlo para todo el carrito.

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  -- Siempre en mayúsculas: el cliente lo escribe como quiera.
  code text not null unique,

  tipo text not null default 'porcentaje' check (tipo in ('porcentaje', 'monto')),
  valor numeric not null check (valor > 0),

  -- Sobre qué parte del carrito se aplica.
  aplica_a text not null default 'todo' check (aplica_a in ('todo', 'juegos', 'packs')),

  -- null = sin límite. Para un cliente puntual, 1.
  max_usos int,
  usos int not null default 0,

  activo boolean not null default true,
  expira_at timestamptz,
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists discount_codes_code_idx on public.discount_codes (upper(code));

-- Qué código usó cada orden y cuánto se descontó, para que cuadre con la venta.
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists discount_amount numeric not null default 0;

-- Políticas abiertas, igual que `orders` y el resto del proyecto: el panel de
-- admin usa la misma clave anónima que la tienda, así que no hay forma de
-- listarlos ahí y ocultarlos aquí.
--
-- OJO: esto significa que alguien con conocimientos podría leer los códigos
-- desde el navegador. Lo que sí queda protegido es el MONTO: el descuento lo
-- calcula validar_codigo() en la base, así que el cliente no puede inventarse
-- una rebaja. Si algún día los códigos deben ser secretos de verdad, hay que
-- mover el ABM a una ruta del servidor con la service role key.
alter table public.discount_codes enable row level security;
drop policy if exists "Lectura pública de códigos" on public.discount_codes;
drop policy if exists "Escritura pública de códigos" on public.discount_codes;
drop policy if exists "Insertar códigos" on public.discount_codes;
drop policy if exists "Eliminar códigos" on public.discount_codes;
create policy "Lectura pública de códigos" on public.discount_codes for select using (true);
create policy "Escritura pública de códigos" on public.discount_codes for update using (true);
create policy "Insertar códigos" on public.discount_codes for insert with check (true);
create policy "Eliminar códigos" on public.discount_codes for delete using (true);


-- VALIDACIÓN
-- Recibe los subtotales del carrito y devuelve cuánto corresponde descontar.
-- Vive en la base para que el monto no dependa de lo que diga el navegador:
-- el cliente manda su carrito, no el descuento.
create or replace function public.validar_codigo(
  p_code text,
  p_total_juegos numeric,
  p_total_packs numeric
)
returns table (valido boolean, motivo text, descuento numeric, aplica_a text)
as $$
declare
  c public.discount_codes%rowtype;
  base numeric;
  desc_calc numeric;
begin
  select * into c from public.discount_codes
   where upper(code) = upper(trim(p_code)) limit 1;

  if not found then
    return query select false, 'Ese código no existe.', 0::numeric, null::text; return;
  end if;
  if not c.activo then
    return query select false, 'Ese código ya no está disponible.', 0::numeric, null::text; return;
  end if;
  if c.expira_at is not null and c.expira_at < now() then
    return query select false, 'Ese código ya venció.', 0::numeric, null::text; return;
  end if;
  if c.max_usos is not null and c.usos >= c.max_usos then
    return query select false, 'Ese código ya se usó.', 0::numeric, null::text; return;
  end if;

  base := case c.aplica_a
            when 'juegos' then coalesce(p_total_juegos, 0)
            when 'packs'  then coalesce(p_total_packs, 0)
            else coalesce(p_total_juegos, 0) + coalesce(p_total_packs, 0)
          end;

  if base <= 0 then
    return query select false,
      case c.aplica_a when 'juegos' then 'Ese código solo aplica a juegos.'
                      when 'packs'  then 'Ese código solo aplica a packs.'
                      else 'Tu carrito está vacío.' end,
      0::numeric, c.aplica_a;
    return;
  end if;

  desc_calc := case c.tipo when 'porcentaje' then round(base * c.valor / 100) else c.valor end;
  -- Nunca más que la base: un monto fijo grande no puede dejar el total negativo.
  if desc_calc > base then desc_calc := base; end if;

  return query select true, null::text, desc_calc, c.aplica_a;
end;
$$ language plpgsql security definer;

grant execute on function public.validar_codigo(text, numeric, numeric) to anon, authenticated;


-- CONSUMO
-- El uso se cuenta cuando el pago queda aprobado, no al crear la orden: si no,
-- un carrito abandonado quemaría un código de un solo uso.
create or replace function public.consumir_codigo_al_pagar()
returns trigger as $$
begin
  if NEW.payment_status = 'approved'
     and OLD.payment_status is distinct from 'approved'
     and NEW.discount_code is not null then
    update public.discount_codes
       set usos = usos + 1
     where upper(code) = upper(NEW.discount_code);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_consumir_codigo on public.orders;
create trigger trigger_consumir_codigo
  after update of payment_status on public.orders
  for each row execute function public.consumir_codigo_al_pagar();
