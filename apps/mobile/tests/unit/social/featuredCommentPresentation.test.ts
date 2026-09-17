import { featuredCommentActionLabel } from '@/features/social/featuredCommentPresentation'

describe('featured comment presentation', () => {
  it('labels the conversation with a singular interaction count', () => {
    expect(featuredCommentActionLabel(1)).toBe('See the conversation (1 interaction)')
  })

  it('labels plural counts and floors invalid input safely', () => {
    expect(featuredCommentActionLabel(3)).toBe('See the conversation (3 interactions)')
    expect(featuredCommentActionLabel(Number.NaN)).toBe('See the conversation (0 interactions)')
    expect(featuredCommentActionLabel(-4)).toBe('See the conversation (0 interactions)')
    expect(featuredCommentActionLabel(2.9)).toBe('See the conversation (2 interactions)')
  })
})
