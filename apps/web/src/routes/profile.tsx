import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import type React from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { PostMediaGrid } from '../features/social/PostMediaGrid'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

type ProfilePost = NonNullable<ReturnType<typeof useQuery<typeof api.social.byUser>>>[number]
type ProfileReview = NonNullable<ReturnType<typeof useQuery<typeof api.reviews.forCompanion>>>[number]
type ProfileContentTab = 'posts' | 'reviews'

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
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contentTab, setContentTab] = useState<ProfileContentTab>('posts')
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
  const profileImageUrl = viewer?.profileImageUrl ?? user?.imageUrl ?? ''
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

      <section className="profile-content-panel mt-6">
        <div className="profile-content-tabs" role="tablist" aria-label="Profile content">
          <ProfileContentTabButton
            tab="posts"
            selected={contentTab === 'posts'}
            onSelect={setContentTab}
          >
            Posts
          </ProfileContentTabButton>
          <ProfileContentTabButton
            tab="reviews"
            selected={contentTab === 'reviews'}
            onSelect={setContentTab}
          >
            Reviews
          </ProfileContentTabButton>
        </div>

        {contentTab === 'posts' ? (
          <div id="profile-posts-panel" role="tabpanel" aria-labelledby="profile-posts-tab">
            <div className="profile-tab-panel-header">
              <div>
                <h2 className="text-h2">Posts</h2>
                <p className="text-meta mt-1">Posts visible from your member profile.</p>
              </div>
              <Link to="/" className="btn btn-neutral btn-sm">Open Home</Link>
            </div>
            {viewer && posts === undefined && <div className="empty-state m-5">Loading posts...</div>}
            {(!viewer || (posts && posts.length === 0)) && (
              <div className="empty-state m-5">
                <p className="empty-state-title">No posts yet.</p>
                <p className="text-meta">Share a post from Home when you are ready.</p>
              </div>
            )}
            {posts && posts.length > 0 && (
              <div className="worklist">
                {posts.map((post) => (
                  <article key={post._id} className="worklist-row">
                    <div className="worklist-row-head">
                      <div className="min-w-0">
                        <h3 className="text-h3">{displayName}</h3>
                        <div className="worklist-row-meta tabular">{formatTime(post.createdAt)}</div>
                      </div>
                    </div>
                    {post.body && <p className="text-body muted whitespace-pre-wrap">{post.body}</p>}
                    {post.media.length > 0 && <PostMediaGrid media={post.media} className="profile-post-media" />}
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div id="profile-reviews-panel" role="tabpanel" aria-labelledby="profile-reviews-tab">
            <div className="profile-tab-panel-header">
              <div>
                <h2 className="text-h2">Reviews</h2>
                <p className="text-meta mt-1">Ratings from members after completed plans.</p>
              </div>
              {application?.reviewCount ? (
                <div className="profile-rating-summary" aria-label={`${application.rating.toFixed(1)} out of 5 from ${application.reviewCount} reviews`}>
                  <strong>{application.rating.toFixed(1)}</strong>
                  <span>★</span>
                  <small>{application.reviewCount} {application.reviewCount === 1 ? 'review' : 'reviews'}</small>
                </div>
              ) : null}
            </div>
            {!application && (
              <div className="empty-state m-5">
                <p className="empty-state-title">Reviews appear after you become a Companion.</p>
                <p className="text-meta">Members can leave a review after a completed plan.</p>
                <Link to="/become-companion" className="btn btn-neutral btn-sm mt-3">Create Companion profile</Link>
              </div>
            )}
            {application && reviews === undefined && <div className="empty-state m-5">Loading reviews...</div>}
            {application && reviews && reviews.length === 0 && (
              <div className="empty-state m-5">
                <p className="empty-state-title">No reviews yet.</p>
                <p className="text-meta">Reviews will appear here after members complete plans with you.</p>
              </div>
            )}
            {reviews && reviews.length > 0 && (
              <div className="worklist">
                {reviews.map((review) => <ProfileReviewRow key={review._id} review={review} />)}
              </div>
            )}
          </div>
        )}
      </section>

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

function ProfileContentTabButton({
  tab,
  selected,
  onSelect,
  children,
}: {
  tab: ProfileContentTab
  selected: boolean
  onSelect: (tab: ProfileContentTab) => void
  children: React.ReactNode
}) {
  const otherTab: ProfileContentTab = tab === 'posts' ? 'reviews' : 'posts'

  return (
    <button
      id={`profile-${tab}-tab`}
      type="button"
      role="tab"
      className="profile-content-tab"
      aria-selected={selected}
      aria-controls={`profile-${tab}-panel`}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(tab)}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const nextTab = event.key === 'Home' ? 'posts' : event.key === 'End' ? 'reviews' : otherTab
        onSelect(nextTab)
        requestAnimationFrame(() => document.getElementById(`profile-${nextTab}-tab`)?.focus())
      }}
    >
      {children}
    </button>
  )
}

function ProfileReviewRow({ review }: { review: ProfileReview }) {
  return (
    <article className="worklist-row">
      <div className="worklist-row-head">
        <div className="min-w-0">
          <h3 className="text-h3">{review.rating}★ from {review.reviewerDisplayName}</h3>
          <div className="worklist-row-meta tabular">{formatTime(review.createdAt)}</div>
        </div>
      </div>
      {review.body && <p className="text-body muted">{review.body}</p>}
    </article>
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
    <span className={className} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials(name)}</span>}
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

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
