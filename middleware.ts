import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // בדוק נוכחות של Supabase auth cookie
  const hasAuth = request.cookies.getAll().some(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  const isAuthPage = pathname.startsWith('/login')
  const isPublic = isAuthPage || pathname === '/'

  if (!hasAuth && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasAuth && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
