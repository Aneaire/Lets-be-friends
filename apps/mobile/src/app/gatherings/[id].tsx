import type { ErrorBoundaryProps } from 'expo-router'

import { GatheringWorkspaceScreen } from '@/features/gatherings/GatheringWorkspaceScreen'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'

export default GatheringWorkspaceScreen

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <StateView embedded title="Gathering unavailable" detail="This Gathering is not open to you right now. No action was taken." actionLabel="Go back" onAction={retry} />
    </Screen>
  )
}
