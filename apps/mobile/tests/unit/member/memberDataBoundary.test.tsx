import { MemberDataBoundary } from '@/member/MemberDataBoundary'
import { MobileMemberStateProvider } from '@/member/MobileMemberContext'

describe('member data boundary', () => {
  it('renders fallbackChildren instead of re-rendering a throwing provider child', () => {
    const throwingProvider = { type: 'ThrowingProvider' } as never
    const appTree = { type: 'AppTree' } as never
    const boundary = new MemberDataBoundary({
      resetKey: 'session-1:user-1',
      fallbackChildren: appTree,
      children: throwingProvider,
    })

    expect(boundary.render()).toBe(throwingProvider)

    boundary.state = MemberDataBoundary.getDerivedStateFromError()
    const fallback = boundary.render() as any

    expect(fallback.type).toBe(MobileMemberStateProvider)
    expect(fallback.props.value).toEqual({
      status: 'error',
      message: 'Your member profile is temporarily unavailable. Please try again later.',
    })
    expect(fallback.props.children).toBe(appTree)
  })

  it('falls back to children when fallbackChildren is omitted and resets on account change', () => {
    const probe = { type: 'BoundaryProbe' } as never
    const boundary = new MemberDataBoundary({
      resetKey: 'session-1:user-1',
      children: probe,
    })
    boundary.state = MemberDataBoundary.getDerivedStateFromError()
    const setState = jest.fn()
    boundary.setState = setState as never

    const fallback = boundary.render() as any
    expect(fallback.props.children).toBe(probe)

    ;(boundary as unknown as { props: { resetKey: string; children: unknown } }).props = {
      resetKey: 'no-session:no-user',
      children: probe,
    }
    boundary.componentDidUpdate({ resetKey: 'session-1:user-1', children: probe })
    expect(setState).toHaveBeenCalledWith({ failed: false })
  })
})
