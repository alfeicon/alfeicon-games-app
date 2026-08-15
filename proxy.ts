import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Cambia este valor a false cuando la tienda pueda volver a recibir visitas.
// No borra catálogo, órdenes ni ninguna otra información: solo redirige la web pública.
const MAINTENANCE_MODE = true

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (MAINTENANCE_MODE && !pathname.startsWith('/admin') && pathname !== '/fuera-de-servicio') {
    const url = request.nextUrl.clone()
    url.pathname = '/fuera-de-servicio'
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Omitimos la verificación en la ruta de inicio de sesión para evitar bucles infinitos
  if (pathname === '/admin/login') {
    return supabaseResponse
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    pathname.startsWith('/admin')
  ) {
    // Redirigimos a una página de login dedicada o al inicio
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|apple-touch-icon.png|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)'],
}
