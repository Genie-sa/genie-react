import { useState, type ReactNode } from 'react'
import { useGenieTool } from 'genie-react'
import { z } from 'zod'

const FLAG_NAMES = ['beta_banner', 'compact_mode'] as const
type FlagName = (typeof FLAG_NAMES)[number]

export function FlagsPanel(): ReactNode {
  const [flags, setFlags] = useState<Record<FlagName, boolean>>({
    beta_banner: false,
    compact_mode: false,
  })

  useGenieTool({
    name: 'flags',
    kind: 'query',
    description:
      'Current feature-flag values. beta_banner shows the beta callout; compact_mode tightens the flag list styling.',
    handler: () => flags,
  })

  useGenieTool({
    name: 'set_flag',
    kind: 'action',
    idempotent: true,
    description:
      'Sets a feature flag and re-renders the gated UI immediately — no settings menu to find. Verify the effect with a browser snapshot.',
    input: z.object({ flag: z.enum(FLAG_NAMES), value: z.boolean() }),
    handler: ({ flag, value }) => {
      setFlags((current) => ({ ...current, [flag]: value }))
      return { flag, value }
    },
  })

  return (
    <section id="flags">
      <h2>Feature flags</h2>
      {flags.beta_banner && (
        <p className="lab-line" data-testid="beta-banner">
          🚧 beta features enabled
        </p>
      )}
      <ul style={flags.compact_mode ? { lineHeight: 1.1, fontSize: '0.85em' } : undefined}>
        {FLAG_NAMES.map((name) => (
          <li key={name} className="lab-line">
            <label>
              <input
                type="checkbox"
                checked={flags[name]}
                onChange={() => setFlags((current) => ({ ...current, [name]: !current[name] }))}
              />
              {name}
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
