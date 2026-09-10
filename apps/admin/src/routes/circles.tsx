import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../web/convex/_generated/api'
import type { Id } from '../../../web/convex/_generated/dataModel'
import { CircleSafetyConsole } from '../features/circles/CircleSafetyConsole'

type StateFilter = 'all' | 'active' | 'archived' | 'suspended'

export const Route = createFileRoute('/circles')({ component: CirclesPage })

function CirclesPage() {
  const viewer = useQuery(api.users.viewer)
  const allowed = viewer?.role === 'admin'
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedCircleId, setSelectedCircleId] = useState<Id<'circles'> | null>(null)
  const rows = useQuery(api.circles.adminList, allowed ? { state: stateFilter, search: search || undefined } : 'skip')
  const detail = useQuery(api.circles.adminDetail, allowed && selectedCircleId ? { circleId: selectedCircleId } : 'skip')
  const setState = useMutation(api.circles.setState)
  const cancelTransfer = useMutation(api.circles.cancelHostTransfer)
  const recoverHost = useMutation(api.circles.emergencyRecoverHost)

  return (
    <CircleSafetyConsole
      allowed={Boolean(allowed)}
      rows={rows}
      detail={detail}
      selectedCircleId={selectedCircleId}
      stateFilter={stateFilter}
      search={search}
      onStateFilterChange={setStateFilter}
      onSearchChange={setSearch}
      onSelect={(circleId) => setSelectedCircleId(circleId as Id<'circles'>)}
      onSetState={async (circleId, state) => { await setState({ circleId: circleId as Id<'circles'>, state }) }}
      onCancelTransfer={async (circleId) => { await cancelTransfer({ circleId: circleId as Id<'circles'> }) }}
      onRecoverHost={async (circleId, recipientUserId, reason) => { await recoverHost({ circleId: circleId as Id<'circles'>, recipientUserId: recipientUserId as Id<'users'>, reason }) }}
    />
  )
}
