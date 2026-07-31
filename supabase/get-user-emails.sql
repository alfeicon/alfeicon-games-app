-- Función para obtener los correos de las cuentas creadas.
-- Sólo los administradores pueden ejecutarla.

create or replace function public.get_admin_user_emails()
returns table (id uuid, email varchar, created_at timestamptz)
language plpgsql security definer
as $$
begin
  -- Verificamos si el usuario actual es admin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'No tienes permisos de administrador';
  end if;

  return query
  select u.id, u.email::varchar, u.created_at
  from auth.users u
  order by u.created_at desc;
end;
$$;

revoke all on function public.get_admin_user_emails from public;
grant execute on function public.get_admin_user_emails to authenticated;
