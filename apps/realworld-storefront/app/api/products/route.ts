import { type NextRequest, NextResponse } from 'next/server'
import { productSummaries } from '../../../lib/data/catalog'

export function GET(request: NextRequest): NextResponse {
  const ids = (request.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean)
  return NextResponse.json({ items: productSummaries(ids.slice(0, 50)) })
}
