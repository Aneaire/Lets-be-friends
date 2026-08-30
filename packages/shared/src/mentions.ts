export const MAX_MENTIONS_PER_POST = 10
export const MAX_MENTIONS_PER_COMMENT = 10
export const MENTION_LOOKUP_LIMIT = 8

const MENTION_TOKEN = /(^|[^a-z0-9_@])@([a-z0-9_]{3,24})\b/gi

export type StoredMention = {
  username: string
  userId: string
}

export type MentionRenderSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; username: string; userId: string }

export function collectMentionUsernames(text: string): string[] {
  const seen = new Set<string>()
  const usernames: string[] = []
  const pattern = new RegExp(MENTION_TOKEN.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const username = match[2].toLowerCase()
    if (!seen.has(username)) {
      seen.add(username)
      usernames.push(username)
    }
  }
  return usernames
}

export function activeMentionQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret)
  const match = before.match(/(?:^|[^a-z0-9_@])@([a-z0-9_]*)$/i)
  if (!match) return null
  const token = match[1].toLowerCase()
  if (!token) return ''
  return token
}

export function withoutLeadingReplyMention(body: string, replyToUsername?: string | null): string {
  const username = replyToUsername?.trim().replace(/^@+/, '')
  if (!username) return body
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return body.replace(new RegExp(`^@${escapedUsername}(?:\\s+|$)`, 'i'), '')
}

export function splitBodyIntoSegments(body: string, mentions: StoredMention[]): MentionRenderSegment[] {
  const byUsername = new Map<string, string>()
  for (const mention of mentions) byUsername.set(mention.username.toLowerCase(), mention.userId)
  const segments: MentionRenderSegment[] = []
  const pattern = new RegExp(MENTION_TOKEN.source, 'gi')
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(body)) !== null) {
    const username = match[2].toLowerCase()
    const userId = byUsername.get(username)
    const mentionStart = match.index + match[1].length
    if (mentionStart > lastIndex) segments.push({ type: 'text', text: body.slice(lastIndex, mentionStart) })
    if (userId) {
      segments.push({ type: 'mention', username, userId })
    } else {
      segments.push({ type: 'text', text: body.slice(mentionStart, pattern.lastIndex) })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) segments.push({ type: 'text', text: body.slice(lastIndex) })
  return segments
}
