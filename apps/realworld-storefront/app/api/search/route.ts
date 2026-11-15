import { type NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '../../../lib/data/catalog'

const MAX_RESULTS = 60

export async function GET(request: NextRequest): Promise<NextResponse> {
  const term = request.nextUrl.searchParams.get('q') ?? ''
  const items = await searchProducts(term, MAX_RESULTS)
  return NextResponse.json({ term, items })
}
