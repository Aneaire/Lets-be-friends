export function featuredCommentActionLabel(interactionCount: number) {
  const safeCount = Number.isFinite(interactionCount) ? Math.max(0, Math.floor(interactionCount)) : 0
  return `See the conversation (${safeCount} ${safeCount === 1 ? 'interaction' : 'interactions'})`
}
