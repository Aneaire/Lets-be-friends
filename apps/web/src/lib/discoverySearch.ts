export type SearchableFriendHost = {
  displayName: string
  city: string
  intro: string
  bio?: string
  strengths?: string[]
  categories?: string[]
}

export function matchesFriendHostSearch(host: SearchableFriendHost, query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const searchableText = [
    host.displayName,
    host.city,
    host.intro,
    host.bio ?? '',
    ...(host.strengths ?? []),
    ...(host.categories ?? []),
  ].join(' ').toLocaleLowerCase()

  return terms.every((term) => searchableText.includes(term))
}
