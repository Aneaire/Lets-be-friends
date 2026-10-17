import { router } from 'expo-router'

import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { Screen } from '@/design-system/templates/Screen'
import { StateView } from '@/design-system/molecules/StateView'
import { VerifiedPresentation, type VerifiedTarget } from '@/features/verification/VerifiedPresentation'
import { buildSignedInProfileViewModel } from '@/member/profileViewModel'
import { useMobileMember } from '@/member/MobileMember'

export default function VerifiedScreen() {
  const member = useMobileMember()

  if (member.status === 'signed_out') {
    return <VerifiedState title="Sign in to see your verification result" action="Sign in" onPress={() => router.replace('/auth')} />
  }
  if (member.status === 'unconfigured' || member.status === 'unavailable' || member.status === 'error') {
    return <VerifiedState title="Verification results need account services" detail={member.status === 'unconfigured' ? 'Connect your account to load your verification status.' : member.message} />
  }
  if (member.status !== 'ready') return <PageSkeleton variant="profile" />

  const profile = buildSignedInProfileViewModel(member.viewer, member.verification)
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/profile')

  return (
    <VerifiedPresentation
      approved={profile.verificationApproved}
      verificationLabel={profile.verificationLabel}
      verificationDetail={profile.verificationDetail}
      onBack={goBack}
      onNavigate={goVerifiedTarget}
    />
  )
}

function goVerifiedTarget(target: VerifiedTarget) {
  switch (target) {
    case 'explore': return router.push('/explore')
    case 'nearby': return router.push('/nearby')
    case 'safety': return router.push('/safety')
    case 'companion': return router.push('/companion')
    case 'profile': return router.push('/profile')
    case 'status': return router.push('/profile')
  }
}

function VerifiedState({ title, detail, action, onPress }: { title: string; detail?: string; action?: string; onPress?: () => void }) {
  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <StateView title={title} detail={detail} actionLabel={action} onAction={onPress} intent="self" />
    </Screen>
  )
}
