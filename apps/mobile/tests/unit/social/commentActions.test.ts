import { commentActionKind, commentDeleteDialog, commentEditError, commentMenuActions } from '@/features/social/commentActions'

describe('comment actions', () => {
  it('offers editing for the comment author and reporting for other members', () => {
    expect(commentActionKind(true)).toBe('edit')
    expect(commentActionKind(false)).toBe('report')
  })

  it('offers delete alongside edit for the comment author behind a confirm step', () => {
    expect(commentMenuActions(true)).toEqual(['edit', 'delete'])
    expect(commentMenuActions(false)).toEqual(['report'])
  })

  it('confirms comment deletion with respectful copy and no em dashes', () => {
    expect(commentDeleteDialog.title).toBe('Delete this comment?')
    expect(commentDeleteDialog.confirmLabel).toBe('Delete comment')
    expect(commentDeleteDialog.cancelLabel).toBe('Keep comment')
    expect(commentDeleteDialog.body).toContain('Replies to this comment stay visible.')
    for (const copy of Object.values(commentDeleteDialog)) {
      expect(copy).not.toContain('—')
      expect(copy).not.toContain('–')
    }
  })

  it('rejects empty and over-limit edits', () => {
    expect(commentEditError('   ')).toBe('Comment cannot be empty.')
    expect(commentEditError('a'.repeat(501))).toBe('Comments can be up to 500 characters.')
    expect(commentEditError('Updated comment')).toBe('')
  })
})
