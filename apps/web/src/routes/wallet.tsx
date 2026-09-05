import { createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useAction, useQuery } from 'convex/react'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { formatPhp } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { MemberWalletPanel } from '../features/wallet/MemberWalletPanel'
import { CompanionWithdrawalPanel } from '../features/wallet/CompanionWithdrawalPanel'

export const Route = createFileRoute('/wallet')({ component: WalletPage })

function WalletPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const memberFinance = useQuery(api.finance.memberDashboard, viewer ? {} : 'skip')
  const createMemberTopUp = useAction(api.paymongo.createMemberTopUp)
  const setNotice = useCallback((message: string) => toast.success(message), [])

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Sign in to view your wallet.</h1>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <p className="text-meta">Your money</p>
        <h1 className="text-h1">Wallet</h1>
        <p className="text-body muted">Top up your booking balance and withdraw Companion earnings in one place.</p>
      </header>

      <MemberWalletPanel
        finance={memberFinance}
        onCreateTopUp={async (amountCentavos) => {
          const result = await createMemberTopUp({ amountCentavos })
          setNotice(result.qrImageUrl
            ? `QR Ph top-up for ${formatPhp(result.amountCentavos)} is ready to scan.`
            : 'PayMongo is confirming the QR Ph top-up. Your wallet will update only after provider verification.')
        }}
      />

      <CompanionWithdrawalPanel />
    </main>
  )
}
