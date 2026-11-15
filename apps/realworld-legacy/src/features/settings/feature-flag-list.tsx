import { useFeatureFlags } from '../../contexts/feature-flags'

export function FeatureFlagList() {
  const { flags } = useFeatureFlags()
  return (
    <ul className="flag-list">
      {Object.entries(flags).map(([name, enabled]) => (
        <li key={name}>
          <code>{name}</code>{' '}
          <span className={enabled ? 'flag flag--on' : 'flag'}>{enabled ? 'on' : 'off'}</span>
        </li>
      ))}
    </ul>
  )
}
