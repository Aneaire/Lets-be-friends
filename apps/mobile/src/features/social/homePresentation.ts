export function homeAccountPresentation(
  authStatus: string,
  memberStatus: string,
) {
  if (memberStatus === 'ready') return 'ready' as const
  if (authStatus === 'loading' || authStatus === 'signed_in') return 'account_loading' as const
  return 'signed_out' as const
}
