export type GuidanceCircleMode = 'online' | 'in_person' | 'both'

export type GuidanceCircle = {
  _id: string
  name: string
  memberCount: number
  mode?: GuidanceCircleMode
  role?: string | null
  muted?: boolean | null
  membershipState?: string | null
  iconUrl?: string
}

export const FRIENDAY_GUIDANCE_TITLE = 'How a Frienday works'

export const FRIENDAY_GUIDANCE_LINES = [
  'A Frienday is the agreed time when a Companion and a member complete a booked activity.',
  'For member wallet bookings, the Companion decides a start photo and the member decides an end photo.',
  'Each photo is optional. Upload one private image or explicitly skip after reading the warning. There is no midpoint photo and no camera requirement.',
  'Keep chat, booking, and payment in the app. Confirm the booking details before acceptance. Those details cannot be edited after acceptance.',
] as const

export function formatGuidanceMode(mode: GuidanceCircleMode | undefined): string | null {
  if (mode === 'in_person') return 'In person'
  if (mode === 'online') return 'Online'
  if (mode === 'both') return 'Online and in person'
  return null
}

export function guidanceCircleMeta(circle: GuidanceCircle): string {
  const parts = [`${circle.memberCount} ${circle.memberCount === 1 ? 'member' : 'members'}`]
  const mode = formatGuidanceMode(circle.mode)
  if (mode) parts.push(mode)
  if (circle.role && circle.role !== 'member') parts.push(circle.role)
  if (circle.muted) parts.push('Muted')
  return parts.join(' · ')
}

/**
 * Mirrors the website current-circle rail order without importing web code:
 * keep active memberships in server order, show the most recent first, and
 * keep up to three more below it. Pure so Home integration can reuse it.
 */
export function selectGuidanceCircles(mine: unknown): {
  top: GuidanceCircle | null
  rest: GuidanceCircle[]
  totalActive: number
} {
  const rows = (Array.isArray(mine) ? mine : []).filter(
    (circle): circle is GuidanceCircle =>
      typeof circle === 'object' &&
      circle !== null &&
      (circle as GuidanceCircle).membershipState === 'active' &&
      typeof (circle as GuidanceCircle)._id === 'string' &&
      typeof (circle as GuidanceCircle).name === 'string' &&
      typeof (circle as GuidanceCircle).memberCount === 'number',
  )
  return { top: rows[0] ?? null, rest: rows.slice(1, 4), totalActive: rows.length }
}

export function guidanceCircleDestination(circleId: string) {
  return {
    pathname: '/circles/[id]' as const,
    params: { id: circleId },
  }
}
