export const MAX_CONVERSATION_LINKS = 100

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi
const TRAILING_PUNCTUATION = /[.,!?;:)\]]$/

/**
 * Extracts the web links a member shared in a message so conversation details
 * can list them without exposing the full message history. Trailing sentence
 * punctuation is trimmed so "https://example.com." becomes a usable link.
 */
export function extractMessageLinks(body: string) {
  const links: string[] = []
  const seen = new Set<string>()
  for (const match of body.match(URL_PATTERN) ?? []) {
    let link = match
    while (link.length > 0 && TRAILING_PUNCTUATION.test(link)) link = link.slice(0, -1)
    if (!link || seen.has(link)) continue
    seen.add(link)
    links.push(link)
  }
  return links
}
