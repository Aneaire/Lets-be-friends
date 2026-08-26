import { postCommentsRoute } from '@/data/socialRoutes'

describe('mobile social routes', () => {
  it('keeps post comments inside the protected mobile navigator', () => {
    expect(postCommentsRoute('post_123')).toEqual({
      pathname: '/post-comments/[id]',
      params: { id: 'post_123' },
    })
  })
})
