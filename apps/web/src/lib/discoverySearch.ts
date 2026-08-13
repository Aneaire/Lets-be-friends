export type SearchableCompanion = {
  username?: string
  displayName: string
  city: string
  intro: string
  bio?: string
  strengths?: string[]
  categories?: string[]
}

export function matchesCompanionSearch(companion: SearchableCompanion, query: string) {
  const terms = query.trim().replace(/^@/, '').toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const searchableText = [
    companion.username ?? '',
    companion.displayName,
    companion.city,
    companion.intro,
    companion.bio ?? '',
    ...(companion.strengths ?? []),
    ...(companion.categories ?? []),
  ].join(' ').toLowerCase()

  return terms.every((term) => searchableText.includes(term))
}

export function findCompanions<T extends SearchableCompanion>(companions: T[], query: string) {
  const normalizedQuery = query.trim().replace(/^@/, '').toLowerCase()
  return companions
    .filter((companion) => matchesCompanionSearch(companion, query))
    .sort((first, second) => {
      const firstExact = first.username?.toLowerCase() === normalizedQuery
      const secondExact = second.username?.toLowerCase() === normalizedQuery
      return Number(secondExact) - Number(firstExact)
    })
}
