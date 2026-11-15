import { Component } from 'react'
import { connect } from 'react-redux'
import { fetchNotifications } from '../store/notifications'

interface NotificationsPollerProps {
  intervalMs: number
  fetchNotifications: () => unknown
}

class NotificationsPoller extends Component<NotificationsPollerProps> {
  private timer: ReturnType<typeof setInterval> | undefined

  componentDidMount() {
    this.props.fetchNotifications()
    this.schedule()
  }

  componentDidUpdate(prevProps: NotificationsPollerProps) {
    if (prevProps.intervalMs !== this.props.intervalMs) {
      clearInterval(this.timer)
      this.schedule()
    }
  }

  schedule() {
    this.timer = setInterval(() => this.props.fetchNotifications(), this.props.intervalMs)
  }

  render() {
    return null
  }
}

export default connect(null, { fetchNotifications })(NotificationsPoller)
