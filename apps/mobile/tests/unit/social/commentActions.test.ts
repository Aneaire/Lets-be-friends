import { commentActionKind, commentEditError } from '@/features/social/commentActions'

describe('comment actions', () => {
  it('offers editing for the comment author and reporting for other members', () => {
    expect(commentActionKind(true)).toBe('edit')
    expect(commentActionKind(false)).toBe('report')
  })

  it('rejects empty and over-limit edits', () => {
    expect(commentEditError('   ')).toBe('Comment cannot be empty.')
    expect(commentEditError('a'.repeat(501))).toBe('Comments can be up to 500 characters.')
    expect(commentEditError('Updated comment')).toBe('')
  })
})
