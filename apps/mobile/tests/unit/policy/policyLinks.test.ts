import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'

import { openPolicyDocument, policyWebUrl } from '@/features/policy/policyLinks'

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }))
jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => undefined) }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

describe('policy website links', () => {
  const originalUrl = process.env.EXPO_PUBLIC_WEB_APP_URL

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_WEB_APP_URL
    else process.env.EXPO_PUBLIC_WEB_APP_URL = originalUrl
    jest.clearAllMocks()
  })

  it('builds the canonical website URLs and tolerates a trailing slash', () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://www.letsbefriends.space/'
    expect(policyWebUrl('terms')).toBe('https://www.letsbefriends.space/terms-and-conditions')
    expect(policyWebUrl('privacy')).toBe('https://www.letsbefriends.space/privacy-policy')
  })

  it('opens the website in the browser instead of a local policy screen', async () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://www.letsbefriends.space'
    await openPolicyDocument('privacy')
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://www.letsbefriends.space/privacy-policy')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('keeps a local fallback for development builds without a web app URL', async () => {
    delete process.env.EXPO_PUBLIC_WEB_APP_URL
    expect(policyWebUrl('terms')).toBeNull()
    await openPolicyDocument('terms')
    expect(router.push).toHaveBeenCalledWith('/terms-and-conditions')
  })

  it('falls back to the system browser when the in-app browser cannot open', async () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://www.letsbefriends.space'
    ;(WebBrowser.openBrowserAsync as jest.Mock).mockRejectedValueOnce(new Error('unavailable'))
    await openPolicyDocument('terms')
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.letsbefriends.space/terms-and-conditions')
  })
})
