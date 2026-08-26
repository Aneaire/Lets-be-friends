import { router } from 'expo-router'

export function openMemberProfile(userId: string, companionProfileId?: string) {
  router.push((companionProfileId
    ? { pathname: '/companion-profile/[id]', params: { id: companionProfileId } }
    : { pathname: '/member-profile/[id]', params: { id: userId } }) as never)
}
