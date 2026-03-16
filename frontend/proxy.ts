import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

// Full redirect — dashboard only (no data to preview)
const isGatedRoute = createRouteMatcher(['/dashboard(.*)'])

// Profile pages get a soft gate (visible but data blurred) — keeps SEO value
// /politicians/[id] and /tickers/[ticker] handled in page components

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req) || isGatedRoute(req)) {
    const { userId } = await auth()
    if (!userId) return NextResponse.redirect(new URL('/pricing', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
