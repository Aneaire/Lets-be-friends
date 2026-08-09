export type SearchableFriendHost = {
  username?: string
  displayName: string
  city: string
  intro: string
  bio?: string
  strengths?: string[]
  categories?: string[]
}

export function matchesFriendHostSearch(host: SearchableFriendHost, query: string) {
  const terms = query.trim().replace(/^@/, '').toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const searchableText = [
    host.username ?? '',
    host.displayName,
    host.city,
    host.intro,
    host.bio ?? '',
    ...(host.strengths ?? []),
    ...(host.categories ?? []),
  ].join(' ').toLowerCase()

  return terms.every((term) => searchableText.includes(term))
}

export function findFriendHosts<T extends SearchableFriendHost>(hosts: T[], query: string) {
  const normalizedQuery = query.trim().replace(/^@/, '').toLowerCase()
  return hosts
    .filter((host) => matchesFriendHostSearch(host, query))
    .sort((first, second) => {
      const firstExact = first.username?.toLowerCase() === normalizedQuery
      const secondExact = second.username?.toLowerCase() === normalizedQuery
      return Number(secondExact) - Number(firstExact)
    })
}
