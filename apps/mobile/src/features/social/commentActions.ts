export type CommentActionKind = 'edit' | 'report'

export type CommentMenuAction = 'edit' | 'delete' | 'report'

export function commentActionKind(ownComment: boolean): CommentActionKind {
  return ownComment ? 'edit' : 'report'
}

export function commentMenuActions(ownComment: boolean): CommentMenuAction[] {
  return ownComment ? ['edit', 'delete'] : ['report']
}

export const commentDeleteDialog = {
  title: 'Delete this comment?',
  body: 'Replies to this comment stay visible. This action cannot be undone.',
  confirmLabel: 'Delete comment',
  cancelLabel: 'Keep comment',
} as const

export function commentEditError(body: string): string {
  if (!body.trim()) return 'Comment cannot be empty.'
  if (body.length > 500) return 'Comments can be up to 500 characters.'
  return ''
}
