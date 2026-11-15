import { type NextRequest, NextResponse } from 'next/server'
import { listReviews, type ReviewSort, UnknownProductError } from '../../../../../lib/data/catalog'
import { SimulatedFailure } from '../../../../../lib/data/simulation'

const SORTS: readonly ReviewSort[] = ['newest', 'highest', 'lowest', 'helpful']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const requested = request.nextUrl.searchParams.get('sort')
  const sort = SORTS.find((candidate) => candidate === requested) ?? 'newest'
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 6) || 6, 36)
  try {
    return NextResponse.json(await listReviews(id, sort, limit))
  } catch (error) {
    if (error instanceof UnknownProductError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof SimulatedFailure) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    throw error
  }
}
