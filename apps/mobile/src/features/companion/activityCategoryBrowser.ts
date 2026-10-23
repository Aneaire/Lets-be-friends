export const ACTIVITY_CATEGORY_PAGE_SIZE = 12

export function filterActivityCategories(values: readonly string[], query: string) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return [...values]
  return values.filter((value) => value.toLocaleLowerCase().includes(normalized))
}

export function visibleActivityCategories(values: readonly string[], query: string, visibleCount: number) {
  return filterActivityCategories(values, query).slice(0, Math.max(0, visibleCount))
}

export function nextActivityCategoryCount(currentCount: number, totalCount: number) {
  return Math.min(currentCount + ACTIVITY_CATEGORY_PAGE_SIZE, Math.max(0, totalCount))
}
