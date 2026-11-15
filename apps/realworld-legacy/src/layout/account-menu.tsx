import { Link } from 'react-router-dom'
import { Avatar } from '../components/avatar'
import { Dropdown } from '../components/dropdown'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { signOut } from '../store/session'

export function AccountMenu() {
  const dispatch = useAppDispatch()
  const { user, savedViewCount } = useAppSelector((state) => ({
    user: state.session.user,
    savedViewCount: state.savedViews.views.length,
  }))
  if (!user) return null
  return (
    <Dropdown>
      {({ isOpen, toggle, close }) => (
        <>
          <button
            type="button"
            className="account-menu__trigger"
            aria-label="Account"
            aria-expanded={isOpen}
            onClick={toggle}
          >
            <Avatar name={user.name} />
          </button>
          {isOpen && (
            <div className="menu" role="menu">
              <div className="menu__header">
                <strong>{user.name}</strong>
                <span className="muted">{user.email}</span>
              </div>
              <Link role="menuitem" to="/settings" onClick={close}>
                Settings
              </Link>
              <Link role="menuitem" to="/issues" onClick={close}>
                Saved views ({savedViewCount})
              </Link>
              <button type="button" role="menuitem" onClick={() => dispatch(signOut())}>
                Sign out
              </button>
            </div>
          )}
        </>
      )}
    </Dropdown>
  )
}
