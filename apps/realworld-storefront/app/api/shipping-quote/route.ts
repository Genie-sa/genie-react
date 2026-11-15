import { type NextRequest, NextResponse } from 'next/server'
import { quoteShipping } from '../../../lib/data/checkout'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const quotes = await quoteShipping(
    searchParams.get('country') ?? 'US',
    searchParams.get('postalCode') ?? '',
  )
  return NextResponse.json({ quotes })
}
