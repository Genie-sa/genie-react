---
'genie-react': patch
---

Reserve an interaction's document before awaiting its initial clear, so concurrent begin calls cannot invalidate each other's observation boundaries. Release reservations after failed starts and reject responses invalidated by a bridge clear or document change. Document labelled interaction handles and their temporal attribution limits.
