export type MobileBackendConfiguration =
  | { status: 'configured'; url: string }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }

export type MobileClerkConfiguration =
  | { status: 'configured'; publishableKey: string }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }

export type MobileWebAppConfiguration =
  | { status: 'configured'; url: string }
  | { status: 'missing' | 'invalid' }

export function resolveMobileBackendConfiguration(
  value: string | undefined = process.env.EXPO_PUBLIC_CONVEX_URL,
): MobileBackendConfiguration {
  const candidate = value?.trim()
  if (!candidate) return { status: 'missing' }

  try {
    const url = new URL(candidate)
    const isLocalHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    if (url.protocol !== 'https:' && !isLocalHttp) {
      return { status: 'invalid', message: 'EXPO_PUBLIC_CONVEX_URL must use HTTPS, except for local development.' }
    }
    if (!url.hostname || url.username || url.password || url.search || url.hash) {
      return { status: 'invalid', message: 'EXPO_PUBLIC_CONVEX_URL must be a public deployment URL without credentials, query text, or a fragment.' }
    }
    return { status: 'configured', url: url.toString().replace(/\/$/, '') }
  } catch {
    return { status: 'invalid', message: 'EXPO_PUBLIC_CONVEX_URL is not a valid URL.' }
  }
}

export function resolveMobileWebAppConfiguration(
  value: string | undefined = process.env.EXPO_PUBLIC_WEB_APP_URL,
): MobileWebAppConfiguration {
  const candidate = value?.trim()
  if (!candidate) return { status: 'missing' }

  try {
    const url = new URL(candidate)
    const isLocalHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    if (url.protocol !== 'https:' && !isLocalHttp) return { status: 'invalid' }
    if (!url.hostname || url.username || url.password || url.search || url.hash) return { status: 'invalid' }
    return { status: 'configured', url: url.toString().replace(/\/$/, '') }
  } catch {
    return { status: 'invalid' }
  }
}

export function buildMobileWebHandoffUrl(
  configuration: MobileWebAppConfiguration,
) {
  if (configuration.status !== 'configured') return undefined
  const url = new URL(configuration.url)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/verify-identity`
  return url.toString()
}

export function resolveMobileClerkConfiguration(
  value: string | undefined = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
): MobileClerkConfiguration {
  const candidate = value?.trim()
  if (!candidate) return { status: 'missing' }

  if (!/^pk_(test|live)_[A-Za-z0-9_-]{20,}$/.test(candidate)) {
    return {
      status: 'invalid',
      message: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a valid Clerk publishable key.',
    }
  }

  return { status: 'configured', publishableKey: candidate }
}
