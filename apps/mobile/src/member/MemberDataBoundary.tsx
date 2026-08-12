import { Component, type ErrorInfo, type ReactNode } from 'react'

import { MobileMemberStateProvider } from './MobileMember'

type Props = {
  children: ReactNode
  resetKey: string
}

type State = {
  failed: boolean
}

export class MemberDataBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Provider diagnostics must never be rendered or logged with member data.
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <MobileMemberStateProvider value={{
          status: 'error',
          message: 'Your member profile is temporarily unavailable. Please try again later.',
        }}>
          {this.props.children}
        </MobileMemberStateProvider>
      )
    }
    return this.props.children
  }
}
