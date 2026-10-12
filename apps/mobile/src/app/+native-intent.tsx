import { normalizeGoogleOAuthCallbackPath } from '@/auth/googleOAuth'
import { resolveMobileWebAppConfiguration } from '@/backend/config'
import { normalizeWebSharePath } from '@/data/webLinkRoutes'

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  const oauth = normalizeGoogleOAuthCallbackPath(path)
  if (oauth !== path) return oauth

  const configuration = resolveMobileWebAppConfiguration()
  const webAppUrl = configuration.status === 'configured' ? configuration.url : undefined
  // Allowlisted website share paths (/social, /companion-profile, /circles)
  // resolve to native routes. Foreign hosts, malformed input, and unknown
  // routes return null and fall through to the delivered path unchanged.
  // This is path normalization only, not universal-link association.
  return normalizeWebSharePath(path, webAppUrl) ?? path
}
