import { describe, expect, it } from 'vitest'
import { productMapInitialView, productMapStyleUrl, productMapZoomForRadius } from '../../src/map'

describe('product map defaults', () => {
  it('uses a secure public style and a Philippines-wide initial view', () => {
    expect(productMapStyleUrl).toMatch(/^https:\/\//)
    expect(productMapInitialView.center).toEqual([121.774, 12.8797])
    expect(productMapInitialView.zoom).toBe(5.2)
  })

  it('zooms out as the requested radius grows', () => {
    expect(productMapZoomForRadius()).toBe(11.5)
    expect(productMapZoomForRadius(5)).toBe(9.5)
    expect(productMapZoomForRadius(10)).toBe(8.5)
    expect(productMapZoomForRadius(25)).toBe(7.3)
    expect(productMapZoomForRadius(50)).toBe(6.3)
    expect(productMapZoomForRadius(51)).toBe(5.3)
  })
})
