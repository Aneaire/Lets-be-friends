export const defaultMemberDiscoveryIntro = "A member of the Let's Be Friends community."

export function discoveryResultIntro(
  kind: 'member' | 'companion' | undefined,
  intro: string | null | undefined,
) {
  const normalizedIntro = intro?.trim()
  if (!normalizedIntro) return undefined
  if (kind === 'member' && normalizedIntro === defaultMemberDiscoveryIntro) return undefined
  return normalizedIntro
}
