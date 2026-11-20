import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '../design-system/atoms/Button'

type AccountDeletionSearch = { deleted?: '1' }

export const Route = createFileRoute('/account-deletion')({
  component: AccountDeletionPage,
  validateSearch: (search: Record<string, unknown>): AccountDeletionSearch =>
    search.deleted === '1' ? { deleted: '1' } : {},
  head: () => ({
    meta: [{ title: "Delete your account | Let's Be Friends" }],
  }),
})

export function AccountDeletionPage() {
  const { deleted } = Route.useSearch()
  return (
    <main className="marketing-page legal-page">
      <p className="eyebrow">Your account</p>
      <h1 className="text-display mt-4">Delete your account</h1>

      {deleted ? (
        <p className="text-body mt-4" role="status">
          Your account is closed. Profile details, photos, posts, saved items, bank details, and identity
          images have been deleted. Ratings, bookings, and payment records were kept without your personal
          details so earnings and payouts stay correct.
        </p>
      ) : (
        <>
          <p className="text-body muted mt-4">
            You can delete your account yourself in the app or on the web. Sign in, open Settings, and choose
            Delete account. This page explains what happens next, so you can read it before you decide.
          </p>

          <section className="mt-6">
            <h2 className="text-h2">What is deleted</h2>
            <ul className="text-body muted mt-2">
              <li>Your display name, username, bio, photo, and approximate location.</li>
              <li>Your posts, comments, and their media, plus your saved items and reactions.</li>
              <li>Your bank account details and push notification tokens.</li>
              <li>Your ID images, selfies, and identity review records.</li>
              <li>Your sign-in identity with our authentication provider.</li>
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-h2">What is kept</h2>
            <ul className="text-body muted mt-2">
              <li>Ratings you left or received, without your written review or photos.</li>
              <li>Bookings, wallet entries, and payment records needed for accounting, tax, and dispute handling.</li>
              <li>Safety and moderation records, with your personal details removed.</li>
            </ul>
            <p className="text-body muted mt-2">
              Nothing on this list shows your name, photo, or contact details after deletion.
            </p>
          </section>

          <section className="mt-6">
            <h2 className="text-h2">When you cannot delete yet</h2>
            <p className="text-body muted mt-2">
              Deletion is blocked while your wallet still holds money, while a withdrawal is processing, while
              an experience or its payment is still open, or while you host a Circle. Finish or hand over those
              first, then delete.
            </p>
          </section>

          <section className="mt-6">
            <h2 className="text-h2">Need help</h2>
            <p className="text-body muted mt-2">
              If you cannot sign in, email us at letsbefriends896@gmail.com and ask us to delete the account.
              We will verify ownership before removing anything.
            </p>
          </section>
        </>
      )}

      <nav className="mt-6" aria-label="Account pages">
        <Link to="/privacy-policy" className="btn btn-neutral btn-sm">Privacy Policy</Link>
        <Link to="/settings" className="btn btn-neutral btn-sm ml-2">Settings</Link>
      </nav>

      <div className="mt-6">
        <Link to="/settings">
          <Button intent="self">Go to Settings</Button>
        </Link>
      </div>
    </main>
  )
}
