import { memo } from 'react'
import { PreferencesProvider, usePreferences } from './PreferencesProvider'

const widgets = [
  { id: 'revenue', title: 'Revenue', value: '$48.2k' },
  { id: 'signups', title: 'Signups', value: '312' },
  { id: 'churn', title: 'Churn', value: '1.8%' },
]

const WidgetCard = memo(function WidgetCard({ title, value }: { title: string; value: string }) {
  const { density } = usePreferences()
  return (
    <article className="card" style={{ padding: density === 'compact' ? 8 : 16 }}>
      <h2>{title}</h2>
      <strong>{value}</strong>
    </article>
  )
})

function DensityToggle() {
  const { density, setDensity } = usePreferences()
  return (
    <button
      type="button"
      onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
    >
      Density: {density}
    </button>
  )
}

export function DashboardScreen() {
  return (
    <PreferencesProvider>
      <DensityToggle />
      <div className="grid">
        {widgets.map((widget) => (
          <WidgetCard key={widget.id} title={widget.title} value={widget.value} />
        ))}
      </div>
    </PreferencesProvider>
  )
}
