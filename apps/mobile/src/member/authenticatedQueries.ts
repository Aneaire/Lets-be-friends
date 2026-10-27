export function memberViewerQueryArgs(
  clerkSignedIn: boolean,
  convexAuthenticated: boolean,
): Record<string, never> | 'skip' {
  return clerkSignedIn && convexAuthenticated ? {} : 'skip'
}
