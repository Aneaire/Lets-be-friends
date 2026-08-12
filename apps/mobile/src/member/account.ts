export function isViewerForClerkUser(
  viewer: { clerkUserId: string } | null | undefined,
  clerkUserId: string,
) {
  return viewer?.clerkUserId === clerkUserId
}
