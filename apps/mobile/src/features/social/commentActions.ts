export type CommentActionKind = 'edit' | 'report'

export function commentActionKind(ownComment: boolean): CommentActionKind {
  return ownComment ? 'edit' : 'report'
}

export function commentEditError(body: string): string {
  if (!body.trim()) return 'Comment cannot be empty.'
  if (body.length > 500) return 'Comments can be up to 500 characters.'
  return ''
}
