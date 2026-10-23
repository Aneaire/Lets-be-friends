import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarCheck, Camera, Pencil, Sparkles, User } from 'lucide-react'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { formatPhp } from '@lets-be-friends/shared'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { ActionMenu, type ActionMenuItem } from '../design-system/molecules/ActionMenu'
import { Dialog } from '../design-system/molecules/Dialog'
import { OpenableImage } from '../design-system/molecules/OpenableImage'
import { ProfileContentPanel } from '../features/profile/ProfileContentPanel'
import { ProfilePhotoComposerDialog } from '../features/profile/ProfilePhotoComposerDialog'
import { createCroppedAvatarFile, type AvatarCrop } from '../features/profile/avatarCrop'
import { describeConvexError } from '../lib/convexErrors'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

type ProfilePost = NonNullable<ReturnType<typeof useQuery<typeof api.social.byUser>>>[number]
type ProfileReview = NonNullable<ReturnType<typeof useQuery<typeof api.reviews.forCompanion>>>[number]

function ProfilePage() {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.companions.myApplication)
  const latestMemberVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const posts = useQuery(api.social.byUser, viewer ? { userId: viewer._id } : 'skip') as ProfilePost[] | undefined
  const reviews = useQuery(api.reviews.forCompanion, application ? { companionProfileId: application._id } : 'skip') as ProfileReview[] | undefined
  const identityFlow = useIdentityVerification('member')
  const updateProfile = useMutation(api.users.updateProfile)
  const updateProfilePicture = useMutation(api.social.updateProfilePicture)
  const generateProfileImageUploadUrl = useMutation(api.users.generateProfileImageUploadUrl)
  const toggleLikeReview = useMutation(api.reviews.toggleLike)
  const createReviewComment = useMutation(api.reviews.createComment)
  const deleteReviewComment = useMutation(api.reviews.deleteComment)
  const toggleLikePost = useMutation(api.social.toggleLike)
  const toggleSavePost = useMutation(api.social.toggleSavePost)
  const editPost = useMutation(api.social.editPost)
  const deletePost = useMutation(api.social.deletePost)
  const createPost = useMutation(api.social.createPost)
  const voteOnPoll = useMutation(api.social.voteOnPoll)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const closeEdit = () => setEditOpen(false)

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
  const username = viewer?.username ?? ''
  const bio = viewer?.bio ?? ''
  const interests = viewer?.onboardingCategories ?? []
  const companionStatus = application?.status ?? 'not started'
  const companionCategories = application?.categories ?? []
  const companionStrengths = application?.strengths ?? []
  const companionBoundaries = application?.boundaries ?? []
  const verification = memberVerificationPresentation(
    identityEntitlementStatus(viewer?.verificationStatus ?? 'not_started', viewer?.identityEligible ?? false),
    latestMemberVerification,
  )
  // Mirrors companions.getPublic: a Companion profile is readable by others only
  // while it is approved and the member holds a current identity approval.
  const companionIsPublic = companionStatus === 'approved' && verification.state === 'approved'

  const viewerLocation = typeof viewer?.approximateLatitude === 'number' && typeof viewer?.approximateLongitude === 'number'
    ? `${viewer.approximateLatitude}, ${viewer.approximateLongitude}`
    : ''

  // The three profile actions live behind the menu in the hero's top corner, so
  // the hero stays about the member instead of a stack of buttons.
  const profileActions: ActionMenuItem[] = [
    {
      label: 'Edit profile',
      icon: <Pencil size={16} aria-hidden="true" />,
      tone: 'self',
      onSelect: () => setEditOpen(true),
    },
    {
      label: 'Your bookings',
      icon: <CalendarCheck size={16} aria-hidden="true" />,
      tone: 'social',
      onSelect: () => void navigate({ to: '/app', search: {} }),
    },
    {
      label: application ? 'Edit Companion profile' : 'Become a Companion',
      icon: <Sparkles size={16} aria-hidden="true" />,
      tone: 'self',
      onSelect: () => void navigate({ to: '/become-companion' }),
    },
  ]

  // The photo saves on its own, like a post, so name and bio edits never block
  // the crop the member just chose.
  async function saveProfilePhoto({
    file,
    crop,
    caption,
    shareToFeed,
  }: {
    file: File
    crop: AvatarCrop
    caption: string
    shareToFeed: boolean
  }) {
    const croppedProfileImage = await createCroppedAvatarFile(file, crop)
    const profileImageStorageId = await uploadProfileImage(croppedProfileImage, generateProfileImageUploadUrl)
    if (!profileImageStorageId) throw new Error('Profile image upload failed.')
    await updateProfilePicture({ profileImageStorageId, caption, shareToFeed })
    setNotice(shareToFeed ? 'Profile photo posted.' : 'Profile photo updated.')
  }

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
          <ProfilePhoto
            imageUrl={profileImageUrl}
            name={displayName}
            size="xl"
            onSelect={() => setPhotoOpen(true)}
          />
          <div className="profile-hero-copy">
            <h1 className="text-h1">{displayName}</h1>
            {username && <p className="text-meta">@{username}</p>}
            <p className="text-body muted profile-hero-bio">{bio || 'No bio added yet.'}</p>
          </div>
        </div>
        <div className="profile-hero-menu">
          <ActionMenu label="Profile actions" panelLabel="Profile actions" items={profileActions} />
        </div>
      </section>

      <div className="profile-public-grid">
        <section className="panel profile-about-card">
          <div className="panel-header">
            <div>
              <h2 className="text-h2">About</h2>
              <p className="text-meta mt-1">What other members can see about you.</p>
            </div>
          </div>
          <div className="panel-body">
            <dl className="profile-facts">
              <div>
                <dt>Bio</dt>
                <dd className="profile-about-bio">{bio || 'No bio added yet.'}</dd>
              </div>
              {interests.length > 0 && (
                <div>
                  <dt>Interested in</dt>
                  <dd>
                    <ul className="profile-about-interests">
                      {interests.map((category) => <li key={category}>{category}</li>)}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2 className="text-h2">Account status</h2>
              <p className="text-meta mt-1">Identity verification, and where Nearby places you.</p>
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
              <span className="text-meta">Discovery area</span>
              <span className="text-meta tabular">{viewerLocation || 'Not saved'}</span>
            </div>
            <p className="text-body muted">
              This is the rounded device location Nearby measures distances from, to two decimals. An approved Companion profile also appears on the nearby map at this area.
            </p>
            {!application && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-meta">Companion profile</span>
                  <span className="status-pill" data-tone={companionStatusTone(companionStatus)}>{companionStatusLabel(companionStatus)}</span>
                </div>
                <p className="text-body muted">
                  A Companion profile adds the session format, area, listed rate, and everyday help you want to offer. Only the profile name and photo above are taken from your member profile, and identity verification is the only review.
                </p>
                <Link to="/become-companion" className="btn btn-neutral btn-sm">
                  Become a Companion
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>

      {application && (
        <section className="panel profile-companion-card mt-6">
          <div className="panel-header">
            <div>
              <h2 className="text-h2">Companion profile</h2>
              <p className="text-meta mt-1">The details members read on your public Companion profile.</p>
            </div>
            <span className="status-pill" data-tone={companionStatusTone(companionStatus)}>{companionStatusLabel(companionStatus)}</span>
          </div>
          <div className="panel-body profile-companion-body">
            <div className="profile-companion-copy">
              <p className="eyebrow">What you offer</p>
              <p className="profile-companion-invitation mt-2">{application.intro}</p>
              {companionCategories.length > 0 && (
                <>
                  <p className="eyebrow mt-4">Everyday help and activities</p>
                  <ul className="profile-companion-chips mt-2">
                    {companionCategories.map((category) => <li key={category}>{category}</li>)}
                  </ul>
                </>
              )}
              {companionStrengths.length > 0 && (
                <>
                  <p className="eyebrow mt-4">Strengths</p>
                  <ul className="profile-companion-chips mt-2">
                    {companionStrengths.map((strength) => <li key={strength}>{strength}</li>)}
                  </ul>
                </>
              )}
              {companionBoundaries.length > 0 && (
                <>
                  <p className="eyebrow mt-4">Boundaries</p>
                  <ul className="profile-companion-chips mt-2">
                    {companionBoundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}
                  </ul>
                </>
              )}
            </div>
            <div>
              <dl className="profile-facts">
                <div>
                  <dt>Session format</dt>
                  <dd>{companionModeLabel(application.mode)}</dd>
                </div>
                <div>
                  <dt>Area members read</dt>
                  <dd>{application.city || 'Not set'}</dd>
                </div>
                <div>
                  <dt>Listed hourly rate</dt>
                  <dd className="tabular">
                    {application.hourlyRateCentavos !== undefined
                      ? `${formatPhp(application.hourlyRateCentavos)} per hour`
                      : 'Not set'}
                  </dd>
                </div>
              </dl>
              {companionStatus === 'approved' && !companionIsPublic && (
                <p className="text-meta mt-3">
                  Your profile appears in Explore and on the nearby map once your identity check is approved.
                </p>
              )}
              <div className="profile-companion-actions">
                {companionIsPublic && (
                  <Link to="/companion-profile" search={{ companionProfileId: application._id }} className="btn btn-neutral btn-sm">
                    View public profile
                  </Link>
                )}
                <Link to="/become-companion" className="btn btn-self btn-sm">
                  Edit Companion profile
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <ProfileContentPanel
        className="mt-6"
        ownerName={displayName}
        ownerImageUrl={profileImageUrl || undefined}
        posts={viewer ? posts : []}
        reviews={application ? reviews : null}
        rating={application?.rating}
        reviewCount={application?.reviewCount}
        emptyPostsDescription="Share a post from Home when you are ready."
        unavailableReviewsTitle="Reviews appear after you become a Companion."
        unavailableReviewsDescription="Members can leave a review after a completed plan."
        unavailableReviewsAction={<Link to="/become-companion" className="btn btn-neutral btn-sm mt-3">Create Companion profile</Link>}
        emptyReviewsDescription="Reviews will appear here after members complete plans with you."
        onLikeReview={(review) => toggleLikeReview({ reviewId: review._id as Id<'reviews'> })}
        onCommentReview={(review, body) => createReviewComment({ reviewId: review._id as Id<'reviews'>, body })}
        onDeleteReviewComment={(review, commentId) => deleteReviewComment({ commentId: commentId as Id<'reviewComments'> })}
        onLikePost={(post) => toggleLikePost({ postId: post._id as Id<'posts'> })}
        onSavePost={(post) => toggleSavePost({ postId: post._id as Id<'posts'> })}
        onEditPost={(post, body) => editPost({ postId: post._id as Id<'posts'>, body })}
        onDeletePost={(post) => deletePost({ postId: post._id as Id<'posts'> })}
        onVotePoll={(post, optionId) => voteOnPoll({ postId: post._id as Id<'posts'>, optionId })}
        onSharePostToFeed={async (post, message) => {
          await createPost({ body: message, sharedPostId: post._id as Id<'posts'> })
          setNotice('Post shared to your feed.')
        }}
        onOpenPostComments={(post) => void navigate({ to: '/social', search: { postId: post._id } })}
      />

      <Dialog
        open={editOpen}
        onClose={saving ? () => undefined : closeEdit}
        title="Edit profile"
        description="Name and bio do not need review. Update your picture from your profile photo."
        size="medium"
        className="profile-edit-dialog"
        busy={saving}
        footer={(
          <>
            <button type="button" className="btn btn-neutral" onClick={closeEdit} disabled={saving}>Cancel</button>
            <button type="submit" form="edit-profile-form" className="btn btn-self" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </>
        )}
      >
        <form
          id="edit-profile-form"
          className="profile-edit-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setSaving(true)
            setError('')
            try {
              const form = new FormData(event.currentTarget)
              await updateProfile({
                displayName: String(form.get('displayName') || fallbackName),
                bio: String(form.get('bio') || ''),
              })
              setNotice('Profile saved.')
              closeEdit()
            } catch (profileError) {
              setError(profileError instanceof Error ? describeConvexError(profileError) : 'Profile could not be saved.')
            } finally {
              setSaving(false)
            }
          }}
        >
          <label className="field-row">
            <span className="label">Name</span>
            <input name="displayName" required defaultValue={displayName} className="field" />
          </label>
          <label className="field-row">
            <span className="label">Bio <span className="label-aux">required</span></span>
            <textarea
              name="bio"
              required
              defaultValue={bio}
              className="field min-h-32"
              maxLength={500}
              placeholder="For example: I can help you practice a new language, and I make everyday errands more fun."
            />
          </label>
        </form>
      </Dialog>

      <ProfilePhotoComposerDialog
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        authorName={displayName}
        authorImageUrl={profileImageUrl || undefined}
        onSave={saveProfilePhoto}
      />
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

function ProfilePhoto({
  imageUrl,
  name,
  size,
  onSelect,
}: {
  imageUrl?: string
  name: string
  size?: 'lg' | 'xl'
  onSelect?: () => void
}) {
  const className = size === 'xl' ? 'profile-photo profile-photo-xl' : size === 'lg' ? 'profile-photo profile-photo-lg' : 'profile-photo'

  if (onSelect) {
    return (
      <button
        type="button"
        className={`${className} profile-photo-button`}
        onClick={onSelect}
        aria-label="Update profile picture"
      >
        {imageUrl ? <img src={imageUrl} alt="" /> : <User aria-hidden="true" />}
        <span className="profile-photo-edit-badge" aria-hidden="true"><Camera size={18} /></span>
      </button>
    )
  }

  return (
    <span className={className} aria-hidden={imageUrl ? undefined : true}>
      {imageUrl ? <OpenableImage src={imageUrl} alt={`${name} profile photo`} /> : <User aria-hidden="true" />}
    </span>
  )
}

function companionStatusLabel(status: string) {
  if (status === 'approved') return 'Profile saved'
  // Legacy rows saved under the previous review model.
  if (status === 'pending_review') return 'Saved'
  if (status === 'rejected') return 'Needs changes'
  if (status === 'suspended') return 'Suspended'
  if (status === 'not started') return 'Not started'
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')
}

function companionStatusTone(status: string): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected' || status === 'suspended') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'self'
}

function companionModeLabel(mode: string) {
  if (mode === 'online') return 'Online'
  if (mode === 'in_person') return 'In-person'
  return 'Online and in-person'
}
