import { NextResponse, type NextRequest } from 'next/server'

const AUTH_COOKIE_RE = /^sb-[a-z0-9]+-auth-token$/i

function b64UrlDecode(s: string): string {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  const withPad = pad === 0 ? base64 : base64 + '='.repeat(4 - pad)
  return atob(withPad)
}

function hasValidAuthCookieLocal(request: NextRequest): boolean {
  const all = request.cookies.getAll()
  for (const c of all) {
    if (AUTH_COOKIE_RE.test(c.name)) {
      try {
        const parsed = JSON.parse(decodeURIComponent(c.value))
        const accessToken = parsed?.access_token || parsed?.[0]?.access_token
        if (!accessToken) continue
        const parts = String(accessToken).split('.')
        if (parts.length < 2) continue
        const payload = JSON.parse(b64UrlDecode(parts[1]))
        const exp = Number(payload?.exp)
        if (!exp) continue
        if (Date.now() / 1000 < exp - 30) {
          return true
        }
      } catch {}
    }
  }
  return false
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const userExists = hasValidAuthCookieLocal(request)

  if (userExists && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/', '/login', '/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
