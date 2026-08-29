import {
  pageSkeletonLabel,
  pageSkeletonVariants,
} from '../../../src/design-system/templates/PageSkeleton'

describe('mobile page skeletons', () => {
  it('gives every supported page skeleton a specific accessible loading label', () => {
    const labels = pageSkeletonVariants.map(pageSkeletonLabel)

    expect(labels).toHaveLength(15)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toContain('Loading public profile')
    expect(labels).toContain('Loading booking form')
    expect(labels).toContain('Loading messages')
  })
})
