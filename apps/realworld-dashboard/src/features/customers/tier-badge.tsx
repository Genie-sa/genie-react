import type { CustomerTier } from '../../api/types'
import { Badge, type BadgeTone } from '../../components/ui/badge'

const TIER_TONES: Record<CustomerTier, BadgeTone> = {
  enterprise: 'info',
  growth: 'success',
  starter: 'neutral',
}

export function TierBadge({ tier }: { tier: CustomerTier }) {
  return <Badge tone={TIER_TONES[tier]}>{tier}</Badge>
}
