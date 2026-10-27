import { wrapGetTokenForDiagnostics } from '@/backend/convexTokenDiagnostics'
import { memberViewerQueryArgs } from '@/member/authenticatedQueries'

describe('authenticated member bootstrap recovery', () => {
  it('loads authenticated member queries after an initial token failure recovers', async () => {
    const getToken = jest.fn()
      .mockRejectedValueOnce(new Error('temporary token failure'))
      .mockResolvedValueOnce('valid-token')
    const wrapped = wrapGetTokenForDiagnostics(getToken, jest.fn(), jest.fn(), async () => {})

    const token = await wrapped({ template: 'convex' })

    expect(token).toBe('valid-token')
    expect(memberViewerQueryArgs(true, token !== null)).toEqual({})
  })

  it('keeps private member queries skipped when token recovery is exhausted', async () => {
    const wrapped = wrapGetTokenForDiagnostics(async () => null, jest.fn(), jest.fn(), async () => {})

    const token = await wrapped({ template: 'convex' })

    expect(token).toBeNull()
    expect(memberViewerQueryArgs(true, token !== null)).toBe('skip')
    expect(memberViewerQueryArgs(false, true)).toBe('skip')
  })
})
