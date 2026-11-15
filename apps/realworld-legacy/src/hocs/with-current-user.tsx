import { connect } from 'react-redux'
import type { User } from '../api/types'
import type { RootState } from '../store'

export interface CurrentUserProps {
  currentUser: User | null
}

const mapStateToProps = (state: RootState): CurrentUserProps => ({
  currentUser: state.session.user,
})

export const withCurrentUser = connect(mapStateToProps)
