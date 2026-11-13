import {
  sharePostRoute,
  TAB_BAR_BACKGROUND,
  TAB_BAR_BLUR_INTENSITY,
  TAB_BAR_BLUR_REDUCTION_FACTOR,
  TAB_BAR_HEIGHT,
  TAB_BAR_TINT_OVERLAY,
  tabBadgeLabel,
  tabBarBottomOffset,
  tabBarContentInset,
  tabIsFocused,
  visibleTabBarItems,
} from '../../../src/design-system/templates/tabBarLayout'

describe('native tab bar layout', () => {
  it('keeps Home, Explore, Messages, and Profile around the raised Create action', () => {
    const items = visibleTabBarItems(['index', 'explore', 'bookings', 'messages', 'profile'])

    expect(items.map((item) => item.label)).toEqual(['Home', 'Explore', 'Messages', 'Profile'])
    expect(items.some((item) => item.routeName === 'bookings')).toBe(false)
  })

  it('drops protected destinations for signed-out members', () => {
    const items = visibleTabBarItems(['index', 'explore', 'profile'])

    expect(items.map((item) => item.label)).toEqual(['Home', 'Explore', 'Profile'])
  })

  it('keeps the floating bar close to the home indicator and Android navigation area', () => {
    expect(tabBarBottomOffset(0)).toBe(8)
    expect(tabBarBottomOffset(34)).toBe(26)
    expect(tabBarContentInset(0)).toBe(TAB_BAR_HEIGHT + 8 + 16)
    expect(tabBarContentInset(34)).toBeGreaterThan(tabBarContentInset(0))
  })

  it('caps unread badges at 99+ and hides a zero count', () => {
    expect(tabBadgeLabel(0)).toBeUndefined()
    expect(tabBadgeLabel(4)).toBe('4')
    expect(tabBadgeLabel(99)).toBe('99')
    expect(tabBadgeLabel(128)).toBe('99+')
  })

  it('keeps Profile lit while the hidden Bookings tab is open', () => {
    expect(tabIsFocused('home', 'home')).toBe(true)
    expect(tabIsFocused('messages', 'messages')).toBe(true)
    expect(tabIsFocused('profile', 'bookings')).toBe(true)
    expect(tabIsFocused('messages', 'profile')).toBe(false)
  })

  it('routes the Create action to the Home composer with a fresh request token', () => {
    expect(sharePostRoute(1720000000000)).toEqual({
      pathname: '/',
      params: { compose: '1720000000000' },
    })
  })

  it('keeps the floating bar translucent so content blur stays visible', () => {
    const alphaOf = (rgba: string) => Number(rgba.slice(rgba.lastIndexOf(',') + 1, rgba.lastIndexOf(')')).trim())

    expect(alphaOf(TAB_BAR_BACKGROUND.light)).toBeLessThanOrEqual(0.22)
    expect(alphaOf(TAB_BAR_BACKGROUND.dark)).toBeLessThanOrEqual(0.3)
    expect(alphaOf(TAB_BAR_TINT_OVERLAY.light)).toBeLessThanOrEqual(0.06)
    expect(alphaOf(TAB_BAR_TINT_OVERLAY.dark)).toBeLessThanOrEqual(0.08)
  })

  it('uses a strong native blur with minimal downsampling', () => {
    expect(TAB_BAR_BLUR_INTENSITY.ios).toBeGreaterThanOrEqual(80)
    expect(TAB_BAR_BLUR_INTENSITY.android).toBeGreaterThanOrEqual(90)
    expect(TAB_BAR_BLUR_REDUCTION_FACTOR).toBeLessThanOrEqual(1)
  })
})
