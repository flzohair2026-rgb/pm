import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, any>
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { path: '/', ...options })
          })
        },
      },
    }
  )

  let user = null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session ?? null
    if (session?.user) {
      user = session.user
    } else if (request.nextUrl.pathname.startsWith('/login')) {
      const { data: userRes } = await supabase.auth.getUser()
      user = userRes?.user ?? null
    }
  } catch {}

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/', '/login', '/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
