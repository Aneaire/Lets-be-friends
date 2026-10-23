import {
  ACTIVITY_CATEGORY_PAGE_SIZE,
  filterActivityCategories,
  nextActivityCategoryCount,
  visibleActivityCategories,
} from '@/features/companion/activityCategoryBrowser'

const values = ['Coffee and meals', 'Grocery shopping', 'Dog walking', 'Tech help', 'Garden care']

describe('activity category browser', () => {
  it('shows the full list when the search is empty or whitespace', () => {
    expect(filterActivityCategories(values, '')).toEqual(values)
    expect(filterActivityCategories(values, '   ')).toEqual(values)
  })

  it('filters case-insensitively and returns no matches cleanly', () => {
    expect(filterActivityCategories(values, 'DOG')).toEqual(['Dog walking'])
    expect(filterActivityCategories(values, 'help')).toEqual(['Tech help'])
    expect(filterActivityCategories(values, 'spaceship')).toEqual([])
  })

  it('pages through matching categories and stops at the end', () => {
    expect(visibleActivityCategories(values, '', 2)).toEqual(['Coffee and meals', 'Grocery shopping'])
    expect(nextActivityCategoryCount(2, 40)).toBe(2 + ACTIVITY_CATEGORY_PAGE_SIZE)
    expect(nextActivityCategoryCount(30, 40)).toBe(40)
    expect(nextActivityCategoryCount(4, values.length)).toBe(values.length)
    expect(nextActivityCategoryCount(9, 5)).toBe(5)
  })

  it('resets paging on a new search by filtering before slicing', () => {
    expect(visibleActivityCategories(values, 'g', 1)).toEqual(['Grocery shopping'])
    expect(visibleActivityCategories(values, 'g', ACTIVITY_CATEGORY_PAGE_SIZE)).toEqual(['Grocery shopping', 'Dog walking', 'Garden care'])
  })
})
