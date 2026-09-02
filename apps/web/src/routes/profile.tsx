import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { OpenableImage } from '../design-system/molecules/OpenableImage'
import { ProfileContentPanel } from '../features/profile/ProfileContentPanel'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

type ProfilePost = NonNullable<ReturnType<typeof useQuery<typeof api.social.byUser>>>[number]
type ProfileReview = NonNullable<ReturnType<typeof useQuery<typeof api.reviews.forCompanion>>>[number]

function ProfilePage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.companions.myApplication)
  const latestMemberVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const posts = useQuery(api.social.byUser, viewer ? { userId: viewer._id } : 'skip') as ProfilePost[] | undefined
  const reviews = useQuery(api.reviews.forCompanion, application ? { companionProfileId: application._id } : 'skip') as ProfileReview[] | undefined
  const identityFlow = useIdentityVerification('member')
  const updateProfile = useMutation(api.users.updateProfile)
  const generateProfileImageUploadUrl = useMutation(api.users.generateProfileImageUploadUrl)
  const toggleLikeReview = useMutation(api.reviews.toggleLike)
  const createReviewComment = useMutation(api.reviews.createComment)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null)
  const closeEdit = () => {
    setEditOpen(false)
    setSelectedProfileImage(null)
  }

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Sign in to edit your profile.</h1>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  if (viewer === undefined || application === undefined || (viewer && latestMemberVerification === undefined)) {
    return <main className="marketing-page"><div className="empty-state">Loading profile...</div></main>
  }

  const fallbackName = user?.fullName ?? user?.username ?? 'New friend'
  const displayName = viewer?.displayName ?? fallbackName
  const profileImageUrl = viewer?.profileImageUrl ?? ''
  const bio = viewer?.bio ?? ''
  const companionStatus = application?.status ?? 'not started'
  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer?.verificationStatus ?? 'not_started', viewer?.identityEligible ?? false),
    latestMemberVerification,
    viewer?.identityTestBypassActive ?? false,
  )

  return (
    <main className="profile-page">
      {(notice || identityFlow.message) && (
        <div className="notice notice-success mb-6" role="status" aria-live="polite">
          <span className="notice-icon">✓</span>
          <span>{identityFlow.message || notice}</span>
        </div>
      )}
      {(error || identityFlow.error) && (
        <div className="notice notice-danger mb-6" role="alert">
          <span className="notice-icon">!</span>
          <span>{identityFlow.error || error}</span>
        </div>
      )}

      <section className="profile-hero-panel">
        <div className="profile-hero-body">
          <ProfilePhoto imageUrl={profileImageUrl} name={displayName} size="xl" />
          <div className="profile-hero-copy">
            <p className="text-meta">Personal setup and trust</p>
            <h1 className="text-h1">{displayName}</h1>
            <p className="text-body muted mt-1">{bio || 'No bio added yet.'}</p>
          </div>
          <div className="profile-hero-actions">
            <button type="button" className="btn btn-self btn-sm" onClick={() => setEditOpen(true)}>
              Edit profile
            </button>
            <Link to="/app" search={{}} className="btn btn-neutral btn-sm">Your bookings</Link>
            <Link to="/become-companion" className="btn btn-neutral btn-sm">
              {application ? 'Edit Companion profile' : 'Become a Companion'}
            </Link>
          </div>
        </div>
      </section>

      <div className="profile-public-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="text-h2">About</h2>
              <p className="text-meta mt-1">What other members can see about you.</p>
            </div>
          </div>
          <div className="panel-body">
            <dl className="profile-facts">
              <div>
                <dt>Name</dt>
                <dd>{displayName}</dd>
              </div>
              <div>
                <dt>Bio</dt>
                <dd>{bio || 'No bio added yet.'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2 className="text-h2">Account status</h2>
              <p className="text-meta mt-1">Identity verification and Companion profile progress.</p>
            </div>
          </div>
          <div className="panel-body flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta">Identity verification</span>
              <span className="status-pill" data-tone={verification.tone}>{verification.label}</span>
            </div>
            <p className="text-body muted">{verification.guidance}</p>
            {verification.action !== 'none' && (
              <button
                type="button"
                className="btn btn-self btn-sm"
                onClick={() => void identityFlow.begin()}
                disabled={identityFlow.busy}
              >
                {identityFlow.busy
                  ? 'Opening identity check...'
                  : verification.action === 'continue'
                    ? 'Continue identity check'
                    : verification.action === 'retry'
                      ? 'Start a new identity check'
                      : 'Verify identity'}
              </button>
            )}
            {verification.state === 'approved' && (
              <Link to="/app" search={{}} className="btn btn-social btn-sm">
                Create booking
              </Link>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta">Companion profile</span>
              <span className="status-pill" data-tone={companionStatusTone(companionStatus)}>{companionStatusLabel(companionStatus)}</span>
            </div>
            <p className="text-body muted">
              Your Companion profile uses this name, then adds the Strengths, availability, boundaries, location, and everyday help or activities you want to offer.
            </p>
            <Link to="/become-companion" className="btn btn-neutral btn-sm">
              {application ? 'Edit Companion profile' : 'Become a Companion'}
            </Link>
          </div>
        </aside>
      </div>

      <ProfileContentPanel
        className="mt-6"
        ownerName={displayName}
        posts={viewer ? posts : []}
        reviews={application ? reviews : null}
        rating={application?.rating}
        reviewCount={application?.reviewCount}
        postsDescription="Posts visible from your member profile."
        postsAction={<Link to="/" className="btn btn-neutral btn-sm">Open Home</Link>}
        emptyPostsDescription="Share a post from Home when you are ready."
        unavailableReviewsTitle="Reviews appear after you become a Companion."
        unavailableReviewsDescription="Members can leave a review after a completed plan."
        unavailableReviewsAction={<Link to="/become-companion" className="btn btn-neutral btn-sm mt-3">Create Companion profile</Link>}
        emptyReviewsDescription="Reviews will appear here after members complete plans with you."
        onLikeReview={(review) => toggleLikeReview({ reviewId: review._id as Id<'reviews'> })}
        onCommentReview={(review, body) => createReviewComment({ reviewId: review._id as Id<'reviews'>, body })}
      />

      {editOpen && (
        <div
          className="profile-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEdit()
          }}
        >
          <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                setSaving(true)
                setError('')
                try {
                  const form = new FormData(event.currentTarget)
                  const profileImageStorageId = await uploadProfileImage(
                    selectedProfileImage ?? form.get('profileImage'),
                    generateProfileImageUploadUrl,
                  )
                  await updateProfile({
                    displayName: String(form.get('displayName') || fallbackName),
                    profileImageStorageId,
                    bio: String(form.get('bio') || '') || undefined,
                  })
                  setNotice('Profile saved.')
                  closeEdit()
                } catch (profileError) {
                  setError(profileError instanceof Error ? profileError.message : 'Profile could not be saved.')
                } finally {
                  setSaving(false)
                }
              }}
            >
              <div className="profile-dialog-header">
                <div>
                  <h2 id="edit-profile-title" className="text-h2">Edit profile</h2>
                  <p className="text-meta mt-1">Name, picture, and bio do not need review.</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeEdit}>
                  Cancel
                </button>
              </div>
              <div className="profile-dialog-body">
                <label
                  className="profile-upload-card"
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.currentTarget.dataset.dragging = 'true'
                  }}
                  onDragLeave={(event) => {
                    delete event.currentTarget.dataset.dragging
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    delete event.currentTarget.dataset.dragging
                    setSelectedProfileImage(event.dataTransfer.files.item(0))
                  }}
                >
                  <span className="profile-upload-card-icon" aria-hidden="true">+</span>
                  <span className="profile-upload-card-title">Select or drop an image</span>
                  <span className="profile-upload-card-meta">
                    {selectedProfileImage ? selectedProfileImage.name : 'PNG, JPG, or GIF. 5 MB max.'}
                  </span>
                  <input
                    name="profileImage"
                    type="file"
                    accept="image/*"
                    className="profile-upload-input"
                    onChange={(event) => setSelectedProfileImage(event.currentTarget.files?.item(0) ?? null)}
                  />
                </label>
                <label className="field-row">
                  <span className="label">Name</span>
                  <input name="displayName" required defaultValue={displayName} className="field" />
                </label>
                <label className="field-row">
                  <span className="label">Bio <span className="label-aux">optional</span></span>
                  <textarea
                    name="bio"
                    defaultValue={bio}
                    className="field min-h-32"
                    maxLength={500}
                    placeholder="A short profile bio members can recognize across posts and companion details."
                  />
                </label>
              </div>
              <div className="profile-dialog-footer">
                <button type="button" className="btn btn-neutral btn-sm" onClick={closeEdit}>
                  Close
                </button>
                <button disabled={saving} className="btn btn-self btn-sm">{saving ? 'Saving...' : 'Save profile'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

async function uploadProfileImage(
  input: FormDataEntryValue | null,
  generateUploadUrl: () => Promise<string>,
): Promise<Id<'_storage'> | undefined> {
  if (!(input instanceof File) || input.size === 0) return undefined
  if (!input.type.startsWith('image/')) throw new Error('Profile image must be an image file.')
  if (input.size > 5 * 1024 * 1024) throw new Error('Profile image must be 5 MB or smaller.')

  const uploadUrl = await generateUploadUrl()
  const result = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': input.type },
    body: input,
  })
  if (!result.ok) throw new Error('Profile image upload failed.')
  const { storageId } = await result.json() as { storageId: string }
  return storageId as Id<'_storage'>
}

function ProfilePhoto({ imageUrl, name, size }: { imageUrl?: string; name: string; size?: 'lg' | 'xl' }) {
  const className = size === 'xl' ? 'profile-photo profile-photo-xl' : size === 'lg' ? 'profile-photo profile-photo-lg' : 'profile-photo'
  return (
    <span className={className} aria-hidden={imageUrl ? undefined : true}>
      {imageUrl ? <OpenableImage src={imageUrl} alt={`${name} profile photo`} /> : <span>{initials(name)}</span>}
    </span>
  )
}

function companionStatusLabel(status: string) {
  if (status === 'pending_review') return 'Pending review'
  if (status === 'not started') return 'Not started'
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')
}

function companionStatusTone(status: string): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected' || status === 'suspended') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'self'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
