import { PageHeader } from '../../components/page-header'
import { Spinner } from '../../components/spinner'
import { useGetPreferencesQuery } from '../../api/service'
import { FeatureFlagList } from './feature-flag-list'
import { PreferencesForm } from './preferences-form'
import { ThemePicker } from './theme-picker'

export default function SettingsPage() {
  const { data: preferences, isLoading } = useGetPreferencesQuery()
  return (
    <div className="settings-page">
      <PageHeader title="Settings" />
      <section className="settings-section">
        <h2>Appearance</h2>
        <ThemePicker />
      </section>
      <section className="settings-section">
        <h2>Profile and notifications</h2>
        {isLoading || !preferences ? (
          <Spinner label="Loading preferences" />
        ) : (
          <PreferencesForm preferences={preferences} />
        )}
      </section>
      <section className="settings-section">
        <h2>Feature flags</h2>
        <FeatureFlagList />
      </section>
    </div>
  )
}
