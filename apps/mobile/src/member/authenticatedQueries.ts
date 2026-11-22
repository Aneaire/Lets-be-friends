export function memberViewerQueryArgs(
  clerkSignedIn: boolean,
  convexAuthenticated: boolean,
): Record<string, never> | 'skip' {
  return clerkSignedIn && convexAuthenticated ? {} : 'skip'
}

export function memberVerificationQueryArgs(
  canReadViewer: boolean,
  viewerMatchesAccount: boolean,
  viewerSuspended?: boolean,
): Record<string, never> | 'skip' {
  return canReadViewer && viewerMatchesAccount && !viewerSuspended ? {} : 'skip'
}
