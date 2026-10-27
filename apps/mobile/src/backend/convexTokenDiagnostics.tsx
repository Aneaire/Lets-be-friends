import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'

export type TokenRequestOptions = {
  template?: unknown
  skipCache?: unknown
}

export type TokenFailureCategory =
  | 'AUTH-TEMPLATE'
  | 'AUTH-NETWORK'
  | 'AUTH-SESSION'
  | 'AUTH-TOKEN-EMPTY'
  | 'AUTH-TOKEN-UNKNOWN'

export type ConnectionReference = TokenFailureCategory | 'AUTH-BACKEND'

type CategoryLogger = (message: string, category: TokenFailureCategory) => void
type Delay = (milliseconds: number) => Promise<void>

const TOKEN_RETRY_DELAYS_MS = [150, 400] as const

const TEMPLATE_CODES = new Set([
  'template_missing',
  'template_not_found',
  'jwt_template_missing',
  'jwt_template_not_found',
  'template_invalid',
  'invalid_template',
  'convex_template_missing',
])

const NETWORK_CODES = new Set([
  'clerk_offline',
  'network_error',
  'clerk_network_error',
  'failed_to_fetch',
  'fetch_failed',
  'fetch_error',
  'network_timeout',
  'network_request_failed',
  'timeout',
  'network',
])

const SESSION_CODES = new Set([
  'session_not_found',
  'session_expired',
  'session_revoked',
  'session_token_expired',
  'session_token_invalid',
  'session_token_missing',
  'no_session',
  'no_active_session',
  'session_missing',
  'session_inactive',
  'not_signed_in',
  'signed_out',
  'token_expired',
  'token_invalid',
  'client_session_missing',
  // Clerk's native token minter answers 422 with this code when it must see the
  // previous expired token to mint the next one and the device no longer has it.
  // Only a fresh sign-in restores the missing state, so it is a session failure.
  'missing_expired_token',
])

function normalizeCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.length > 80) return undefined
  if (!/^[a-z0-9_-]+$/.test(trimmed)) return undefined
  return trimmed
}

function collectCandidateCodes(error: Record<string, unknown>): string[] {
  const candidates: string[] = []
  const nested = error.errors
  if (Array.isArray(nested) && nested.length > 0) {
    const first = nested[0]
    if (first !== null && typeof first === 'object') {
      const code = normalizeCode((first as Record<string, unknown>).code)
      if (code) candidates.push(code)
    }
  }
  for (const key of ['code', 'errorCode', 'clerkErrorCode']) {
    const code = normalizeCode(error[key])
    if (code) candidates.push(code)
  }
  return candidates
}

function numericStatus(error: Record<string, unknown>): number | undefined {
  for (const key of ['status', 'statusCode', 'httpStatus']) {
    const value = error[key]
    if (typeof value === 'number' && Number.isInteger(value)) return value
  }
  return undefined
}

function isExactNetworkError(error: Record<string, unknown>): boolean {
  const name = normalizeCode(error.name)
  const message = typeof error.message === 'string' ? error.message.trim().toLowerCase() : undefined
  if (name === 'aborterror') return true
  if (name !== 'typeerror' && name !== 'clerkapiresponseerror') return false
  return message === 'network request failed'
    || message === 'failed to fetch'
    || message === 'fetch failed'
    || message === 'load failed'
    || message === 'the internet connection appears to be offline.'
}

export function classifyConvexTokenError(error: unknown, options?: TokenRequestOptions): Exclude<TokenFailureCategory, 'AUTH-TOKEN-EMPTY'> {
  const templateRequested = !!options && typeof options.template === 'string' && options.template.length > 0
  if (error !== null && typeof error === 'object') {
    const record = error as Record<string, unknown>
    for (const code of collectCandidateCodes(record)) {
      if (TEMPLATE_CODES.has(code)) return 'AUTH-TEMPLATE'
      if (code === 'resource_not_found' && templateRequested) return 'AUTH-TEMPLATE'
      if (SESSION_CODES.has(code)) return 'AUTH-SESSION'
      if (NETWORK_CODES.has(code)) return 'AUTH-NETWORK'
    }
    const status = numericStatus(record)
    if (status === 401 || status === 403) return 'AUTH-SESSION'
    if (status === 408 || status === 429 || (status !== undefined && status >= 500 && status <= 599)) {
      return 'AUTH-NETWORK'
    }
    if (isExactNetworkError(record)) return 'AUTH-NETWORK'
  }
  return 'AUTH-TOKEN-UNKNOWN'
}

export function isRetryableTokenFailure(category: TokenFailureCategory): boolean {
  return category === 'AUTH-NETWORK'
    || category === 'AUTH-TOKEN-UNKNOWN'
    || category === 'AUTH-TOKEN-EMPTY'
}

const CONNECTION_REFERENCES: ReadonlySet<string> = new Set([
  'AUTH-TEMPLATE',
  'AUTH-NETWORK',
  'AUTH-SESSION',
  'AUTH-TOKEN-EMPTY',
  'AUTH-TOKEN-UNKNOWN',
  'AUTH-BACKEND',
])

export function resolveConnectionReference(value: unknown): ConnectionReference {
  if (typeof value === 'string' && CONNECTION_REFERENCES.has(value)) {
    return value as ConnectionReference
  }
  return 'AUTH-BACKEND'
}

export function buildMemberConnectionMessage(failure: unknown): string {
  const reference = resolveConnectionReference(failure)
  if (reference === 'AUTH-SESSION') {
    return `Your sign-in session could not be refreshed. Sign out and sign in again to reconnect your member profile. Reference: ${reference}`
  }
  return `Your member profile could not be connected. Please try again later. Reference: ${reference}`
}

type DiagnosticContextValue = {
  failure: TokenFailureCategory | null
  report: (failure: TokenFailureCategory | null) => void
  retryVersion: number
  retryConnection: () => void
}

const ConvexTokenDiagnosticContext = createContext<DiagnosticContextValue>({
  failure: null,
  report: () => {},
  retryVersion: 0,
  retryConnection: () => {},
})

export function ConvexTokenDiagnosticProvider({ children }: PropsWithChildren) {
  const [failure, setFailure] = useState<TokenFailureCategory | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const report = useCallback((next: TokenFailureCategory | null) => {
    setFailure(next)
  }, [])
  const retryConnection = useCallback(() => {
    setFailure(null)
    setRetryVersion((version) => version + 1)
  }, [])
  const value = useMemo(
    () => ({ failure, report, retryVersion, retryConnection }),
    [failure, report, retryConnection, retryVersion],
  )
  return <ConvexTokenDiagnosticContext.Provider value={value}>{children}</ConvexTokenDiagnosticContext.Provider>
}

export function useConvexTokenFailure(): TokenFailureCategory | null {
  return useContext(ConvexTokenDiagnosticContext).failure
}

export function useConvexConnectionRecovery(): { retryConnection: () => void; retryVersion: number } {
  const { retryConnection, retryVersion } = useContext(ConvexTokenDiagnosticContext)
  return useMemo(() => ({ retryConnection, retryVersion }), [retryConnection, retryVersion])
}

function useReportConvexTokenFailure(): (failure: TokenFailureCategory | null) => void {
  return useContext(ConvexTokenDiagnosticContext).report
}

export function wrapGetTokenForDiagnostics<TArgs extends TokenRequestOptions | undefined>(
  getToken: (options?: TArgs) => Promise<string | null>,
  report: (failure: TokenFailureCategory | null) => void,
  log: CategoryLogger = console.warn,
  delay: Delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  isActive: () => boolean = () => true,
): (options?: TArgs) => Promise<string | null> {
  return async (options?: TArgs) => {
    for (let attempt = 0; attempt <= TOKEN_RETRY_DELAYS_MS.length; attempt += 1) {
      const requestOptions = attempt === 0
        ? options
        : ({ ...(options ?? {}), skipCache: true } as TArgs)
      try {
        const token = await getToken(requestOptions)
        if (!isActive()) return null
        if (token !== null) {
          report(null)
          return token
        }

        const category: TokenFailureCategory = 'AUTH-TOKEN-EMPTY'
        log('[convex-auth] token request failed', category)
        if (attempt === TOKEN_RETRY_DELAYS_MS.length) {
          report(category)
          return null
        }
      } catch (error) {
        if (!isActive()) return null
        const category = classifyConvexTokenError(error, requestOptions ?? undefined)
        log('[convex-auth] token request failed', category)
        if (!isRetryableTokenFailure(category) || attempt === TOKEN_RETRY_DELAYS_MS.length) {
          report(category)
          throw error
        }
      }

      await delay(TOKEN_RETRY_DELAYS_MS[attempt])
      if (!isActive()) return null
    }
    return null
  }
}

export function useDiagnosticClerkGetToken(
  getToken: (options?: { template?: string; skipCache?: boolean }) => Promise<string | null>,
): (options?: { template?: string; skipCache?: boolean }) => Promise<string | null> {
  const report = useReportConvexTokenFailure()
  const active = useRef(true)

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  return useMemo(
    () => wrapGetTokenForDiagnostics(getToken, report, console.warn, undefined, () => active.current),
    [getToken, report],
  )
}
