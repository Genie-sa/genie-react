import classNames from 'classnames'
import { NavLink } from 'react-router-dom'
import ProjectNav from './project-nav'

const LINKS = [
  { to: '/board', label: 'Board' },
  { to: '/issues', label: 'Issues' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

export function SideNav({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={classNames('side-nav', { 'side-nav--collapsed': collapsed })}
      aria-label="Main navigation"
    >
      <nav>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => classNames('side-nav__link', { active: isActive })}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      {!collapsed && <ProjectNav />}
    </aside>
  )
}
