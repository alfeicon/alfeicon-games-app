-- Suscriptores de avisos de nuevos packs.
-- Ejecutar en Supabase SQL Editor una sola vez.

create table if not exists public.newsletter_subscribers (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  subscribed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- Evita duplicados aunque el mismo correo aparezca con mayusculas distintas.
create unique index if not exists newsletter_subscribers_email_lower_idx
  on public.newsletter_subscribers (lower(email));

create index if not exists newsletter_subscribers_active_idx
  on public.newsletter_subscribers (subscribed)
  where subscribed = true;

-- Mantiene updated_at al cambiar la suscripcion.
drop trigger if exists newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_updated_at
before update on public.newsletter_subscribers
for each row execute function public.set_updated_at();

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Users can view own newsletter subscription" on public.newsletter_subscribers;
create policy "Users can view own newsletter subscription"
on public.newsletter_subscribers for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own newsletter subscription" on public.newsletter_subscribers;
create policy "Users can update own newsletter subscription"
on public.newsletter_subscribers for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Registra automaticamente a cada usuario nuevo.
create or replace function public.handle_new_newsletter_subscriber()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and length(trim(new.email)) > 0 then
    insert into public.newsletter_subscribers (id, email)
    values (new.id, lower(trim(new.email)))
    on conflict (id) do update
      set email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_newsletter on auth.users;
create trigger on_auth_user_created_newsletter
after insert on auth.users
for each row execute function public.handle_new_newsletter_subscriber();

-- Carga usuarios existentes sin sobrescribir sus preferencias.
insert into public.newsletter_subscribers (id, email)
select id, lower(trim(email))
from auth.users
where email is not null and length(trim(email)) > 0
on conflict (id) do update
  set email = excluded.email;

-- Funcion para que un usuario pueda darse de baja de forma segura.
create or replace function public.unsubscribe_from_newsletter()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.newsletter_subscribers
  set subscribed = false,
      unsubscribed_at = now(),
      updated_at = now()
  where id = auth.uid();
$$;

revoke all on function public.unsubscribe_from_newsletter() from public;
grant execute on function public.unsubscribe_from_newsletter() to authenticated;
