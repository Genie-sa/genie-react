import { Link } from 'react-router-dom'
import { Button } from '../components/button'
import { useAppDispatch } from '../store/hooks'
import { createIssueToggled, sidebarToggled } from '../store/ui'
import { AccountMenu } from './account-menu'
import { GlobalSearch } from './global-search'
import { LastSyncedLabel } from './last-synced-label'
import { NotificationsMenu } from './notifications-menu'

export function TopBar() {
  const dispatch = useAppDispatch()
  return (
    <header className="top-bar">
      <button
        type="button"
        className="top-bar__toggle"
        aria-label="Toggle sidebar"
        onClick={() => dispatch(sidebarToggled())}
      >
        ☰
      </button>
      <Link to="/board" className="top-bar__logo">
        Acme Tracker
      </Link>
      <GlobalSearch />
      <div className="top-bar__actions">
        <LastSyncedLabel />
        <Button variant="primary" size="sm" onClick={() => dispatch(createIssueToggled(true))}>
          New issue
        </Button>
        <NotificationsMenu />
        <AccountMenu />
      </div>
    </header>
  )
}
