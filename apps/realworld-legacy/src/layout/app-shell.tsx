import classNames from 'classnames'
import { connect } from 'react-redux'
import { Outlet } from 'react-router-dom'
import { useGetConfigQuery } from '../api/service'
import { FeatureFlagsProvider } from '../contexts/feature-flags'
import { CreateIssueModal } from '../features/create-issue/create-issue-modal'
import type { RootState } from '../store'
import NotificationsPoller from './notifications-poller'
import { SideNav } from './side-nav'
import { ToastStack } from './toast-stack'
import { TopBar } from './top-bar'

const NO_FLAGS: Record<string, boolean> = {}

interface AppShellProps {
  sidebarCollapsed: boolean
  createIssueOpen: boolean
}

function AppShell({ sidebarCollapsed, createIssueOpen }: AppShellProps) {
  const { data: config } = useGetConfigQuery()
  return (
    <FeatureFlagsProvider flags={config?.flags ?? NO_FLAGS}>
      <div className={classNames('shell', { 'shell--collapsed': sidebarCollapsed })}>
        <TopBar />
        <SideNav collapsed={sidebarCollapsed} />
        <main className="shell__content">
          <Outlet />
        </main>
        {config && <NotificationsPoller intervalMs={config.notificationPollMs} />}
        {createIssueOpen && <CreateIssueModal />}
        <ToastStack />
      </div>
    </FeatureFlagsProvider>
  )
}

const mapStateToProps = (state: RootState): AppShellProps => ({
  sidebarCollapsed: state.ui.sidebarCollapsed,
  createIssueOpen: state.ui.createIssueOpen,
})

export default connect(mapStateToProps)(AppShell)
