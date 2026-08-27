import { normalizeGoogleOAuthCallbackPath } from '@/auth/googleOAuth'

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return normalizeGoogleOAuthCallbackPath(path)
}
