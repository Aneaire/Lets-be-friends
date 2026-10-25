import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { formatPhp } from '@lets-be-friends/shared'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { Chip } from '@/design-system/atoms/Chip'
import { StatusBadge } from '@/design-system/atoms/StatusBadge'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { IconButton } from '@/design-system/atoms/IconButton'
import { VerifiedBadge } from '@/design-system/atoms/VerifiedBadge'
import { ActionSheet } from '@/design-system/molecules/ActionSheet'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { MemberProfilePosts } from '@/member/MemberProfilePosts'
import { ReviewFeedCard } from '@/features/social/ReviewFeedCard'
import { memberContentTabLabel, toOwnReviewFeedItem, type MemberPost } from '@/member/memberContent'
import { companionModeLabel, companionStatusLabel, companionStatusTone, profileActionLabels } from '@/member/profileSections'
import { useAppTheme } from '@/theme/ThemeProvider'

export type ProfileCompanionDetails = {
  status: string
  intro: string
  categories: string[]
  strengths: string[]
  boundaries: string[]
  mode: string
  city?: string | null
  hourlyRateCentavos?: number | null
  rating?: number | null
  reviewCount?: number | null
  publicProfileId?: string | null
}

export type ProfileReviewsStatus = 'loading' | 'needs_companion' | 'empty' | 'ready'

export function SignedInProfileContent({
  displayName,
  username,
  bio,
  imageUrl,
  interests,
  memberSince,
  roleLabel,
  verificationLabel,
  verificationDetail,
  verificationApproved,
  verificationAction,
  openingVerification,
  discoveryArea,
  companion,
  hasApplication,
  fullyVerified,
  posts,
  reviews,
  reviewsStatus,
  rating,
  reviewCount,
  onEditProfile,
  onOpenBookings,
  onOpenCompanion,
  onOpenVerification,
  onCreateBooking,
  onOpenPublicProfile,
  onOpenSettings,
}: {
  displayName: string
  username: string
  bio: string
  imageUrl?: string
  interests: string[]
  memberSince: string
  roleLabel: string
  verificationLabel: string
  verificationDetail: string
  verificationApproved: boolean
  verificationAction: 'verify' | 'continue' | 'retry' | 'none'
  openingVerification: boolean
  discoveryArea: string
  companion: ProfileCompanionDetails | null
  hasApplication: boolean
  fullyVerified: boolean
  posts: MemberPost[] | undefined
  reviews: Array<{ _id: string; [key: string]: unknown }> | undefined
  reviewsStatus: ProfileReviewsStatus
  rating?: number | null
  reviewCount?: number | null
  onEditProfile: () => void
  onOpenBookings: () => void
  onOpenCompanion: () => void
  onOpenVerification: () => void
  onCreateBooking: () => void
  onOpenPublicProfile: () => void
  onOpenSettings: () => void
}) {
  const theme = useAppTheme()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [tab, setTab] = useState<'posts' | 'reviews'>('posts')
  const actions = profileActionLabels(hasApplication)

  return (
    <Screen contentStyle={styles.content}>
      <View style={[styles.hero, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <View style={styles.heroTop}>
          <IconButton label="Open settings" icon="settings-outline" tone="self" onPress={onOpenSettings} />
          <View style={styles.avatarWrap}>
            <Avatar uri={imageUrl} name={displayName} size={88} />
            {fullyVerified ? (
              <View style={styles.avatarBadge}>
                <VerifiedBadge label="Identity and Companion profile verified" />
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile actions"
            accessibilityHint="Edit profile, bookings, and Companion profile options"
            onPress={() => setActionsOpen(true)}
            style={({ pressed }) => [styles.actionsButton, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
            <AppIcon name="ellipsis-horizontal" color={theme.colors.text} size={22} />
          </Pressable>
        </View>
        <View style={styles.heroCopy}>
          <AppText variant="title" style={styles.center}>{displayName}</AppText>
          {username ? <AppText variant="caption" color={theme.colors.textMuted} style={styles.center}>{username}</AppText> : null}
          <AppText variant="caption" color={theme.colors.textMuted} style={styles.center}>{memberSince} · {roleLabel}</AppText>
          {fullyVerified ? <AppText variant="caption" color={theme.colors.textMuted} style={styles.center}>Identity and Companion profile verified.</AppText> : null}
          <AppText color={theme.colors.text} style={styles.center}>{bio || 'No bio added yet.'}</AppText>
        </View>
      </View>

      <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
        <AppText variant="heading">About</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>What other members can see about you.</AppText>
        <View style={styles.facts}>
          <View style={styles.fact}>
            <AppText variant="label" color={theme.colors.textMuted}>BIO</AppText>
            <AppText>{bio || 'No bio added yet.'}</AppText>
          </View>
          {interests.length > 0 ? (
            <View style={styles.fact}>
              <AppText variant="label" color={theme.colors.textMuted}>INTERESTED IN</AppText>
              <View style={styles.chips}>
                {interests.map((interest) => <Chip key={interest} label={interest} />)}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
        <AppText variant="heading">Account status</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Identity verification, and where Nearby places you.</AppText>
        <View style={styles.statusRow}>
          <AppText variant="caption" color={theme.colors.textMuted} style={styles.statusLabel}>Identity verification</AppText>
          <View style={styles.statusValue}>
            <StatusBadge label={verificationLabel} tone={verificationApproved ? 'success' : verificationLabel.includes('pending') || verificationLabel.includes('Pending') ? 'warning' : 'self'} />
          </View>
        </View>
        <AppText color={theme.colors.textMuted}>{verificationDetail}</AppText>
        {verificationAction !== 'none' ? (
          <ActionButton
            label={openingVerification ? 'Opening identity check' : verificationAction === 'continue' ? 'Continue identity check' : verificationAction === 'retry' ? 'Start a new identity check' : 'Verify identity'}
            onPress={onOpenVerification}
            intent="self"
            disabled={openingVerification}
          />
        ) : null}
        {verificationApproved ? <ActionButton label="Create booking" onPress={onCreateBooking} intent="social" /> : null}
        <View style={styles.statusRow}>
          <AppText variant="caption" color={theme.colors.textMuted} style={styles.statusLabel}>Discovery area</AppText>
          <AppText variant="caption" color={theme.colors.textMuted} style={styles.statusValueText}>{discoveryArea || 'Not saved'}</AppText>
        </View>
        <AppText variant="caption" color={theme.colors.textMuted}>
          This is the rounded device location Nearby measures distances from, to two decimals. An approved Companion profile also appears on the nearby map at this area.
        </AppText>
        {!companion ? (
          <View style={styles.companionEmpty}>
            <View style={styles.statusRow}>
              <AppText variant="caption" color={theme.colors.textMuted} style={styles.statusLabel}>Companion profile</AppText>
              <View style={styles.statusValue}>
                <StatusBadge label={companionStatusLabel('not started')} tone={companionStatusTone('not started')} />
              </View>
            </View>
            <AppText color={theme.colors.textMuted}>
              A Companion profile adds the session format, area, listed rate, and everyday help you want to offer. Identity verification is the only review.
            </AppText>
            <ActionButton label="Become a Companion" onPress={onOpenCompanion} intent="self" secondary />
          </View>
        ) : null}
      </View>

      {companion ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
          <View style={styles.statusRow}>
            <View style={styles.cardHeading}>
              <AppText variant="heading">Companion profile</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>The details members read on your public Companion profile.</AppText>
            </View>
            <View style={styles.statusValue}>
              <StatusBadge label={companionStatusLabel(companion.status)} tone={companionStatusTone(companion.status)} />
            </View>
          </View>
          <View style={styles.facts}>
            <View style={styles.fact}>
              <AppText variant="label" color={theme.colors.textMuted}>WHAT YOU OFFER</AppText>
              <AppText>{companion.intro}</AppText>
            </View>
            {companion.categories.length > 0 ? (
              <View style={styles.fact}>
                <AppText variant="label" color={theme.colors.textMuted}>EVERYDAY HELP AND ACTIVITIES</AppText>
                <View style={styles.chips}>
                  {companion.categories.map((category) => <Chip key={category} label={category} />)}
                </View>
              </View>
            ) : null}
            {companion.strengths.length > 0 ? (
              <View style={styles.fact}>
                <AppText variant="label" color={theme.colors.textMuted}>STRENGTHS</AppText>
                <View style={styles.chips}>
                  {companion.strengths.map((strength) => <Chip key={strength} label={strength} />)}
                </View>
              </View>
            ) : null}
            {companion.boundaries.length > 0 ? (
              <View style={styles.fact}>
                <AppText variant="label" color={theme.colors.textMuted}>BOUNDARIES</AppText>
                {companion.boundaries.map((boundary) => <AppText key={boundary}>· {boundary}</AppText>)}
              </View>
            ) : null}
            <View style={styles.fact}>
              <AppText variant="label" color={theme.colors.textMuted}>SESSION FORMAT</AppText>
              <AppText>{companionModeLabel(companion.mode)}</AppText>
            </View>
            <View style={styles.fact}>
              <AppText variant="label" color={theme.colors.textMuted}>AREA MEMBERS READ</AppText>
              <AppText>{companion.city || 'Not set'}</AppText>
            </View>
            <View style={styles.fact}>
              <AppText variant="label" color={theme.colors.textMuted}>LISTED HOURLY RATE</AppText>
              <AppText>{typeof companion.hourlyRateCentavos === 'number' ? `${formatPhp(companion.hourlyRateCentavos)} per hour` : 'Not set'}</AppText>
            </View>
          </View>
          {companion.status === 'approved' && !companion.publicProfileId ? (
            <AppText variant="caption" color={theme.colors.textMuted}>
              Your profile appears in Explore and on the nearby map once your identity check is approved.
            </AppText>
          ) : null}
          <View style={styles.companionActions}>
            {companion.publicProfileId ? <ActionButton label="View public profile" onPress={onOpenPublicProfile} intent="neutral" secondary /> : null}
            <ActionButton label="Edit Companion profile" onPress={onOpenCompanion} intent="self" />
          </View>
        </View>
      ) : null}

      <View style={styles.contentSection}>
        <SegmentedControl
          label={`${displayName} profile content`}
          value={tab}
          onChange={setTab}
          tone="social"
          options={(['posts', 'reviews'] as const).map((value) => ({ value, label: memberContentTabLabel(value) }))}
        />
        {tab === 'posts' ? (
          <MemberProfilePosts
            ownerName={displayName}
            posts={posts}
            signedIn
            showSignInPrompt={false}
            emptyDescription="Share a post from Home when you are ready."
          />
        ) : (
          <View style={styles.reviews}>
            <AppText variant="heading">Reviews of your Companion profile</AppText>
            {typeof rating === 'number' && typeof reviewCount === 'number' ? (
              <AppText variant="caption" color={theme.colors.textMuted} accessibilityLabel={`${rating.toFixed(1)} out of 5 from ${reviewCount} reviews`}>
                {rating.toFixed(1)} out of 5 from {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </AppText>
            ) : null}
            {reviewsStatus === 'loading' ? (
              <AppText variant="caption" color={theme.colors.textMuted}>Loading reviews.</AppText>
            ) : reviewsStatus === 'needs_companion' ? (
              <StateView
                embedded
                title="Reviews appear after you become a Companion"
                detail="Members can leave a review after a completed plan."
                actionLabel="Create Companion profile"
                onAction={onOpenCompanion}
                intent="self"
              />
            ) : reviewsStatus === 'empty' ? (
              <StateView embedded title="No reviews yet" detail="Reviews will appear here after members complete plans with you." />
            ) : (
              <View style={styles.reviewList}>
                {(reviews ?? []).map((review) => (
                  <ReviewFeedCard key={String(review._id)} item={toOwnReviewFeedItem(review, displayName) as never} signedIn onAction={() => undefined} />
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <ActionSheet
        visible={actionsOpen}
        title="Profile actions"
        description="Manage your member profile, bookings, and Companion profile."
        onClose={() => setActionsOpen(false)}
        items={actions.map((action) => ({
          label: action.label,
          icon: action.id === 'edit' ? 'pencil-outline' : action.id === 'bookings' ? 'calendar-outline' : 'sparkles-outline',
          tone: action.id === 'bookings' ? 'social' : 'self',
          onPress: () => {
            if (action.id === 'edit') onEditProfile()
            else if (action.id === 'bookings') onOpenBookings()
            else onOpenCompanion()
          },
        } as const))}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  hero: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12, alignItems: 'center' },
  heroTop: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroCopy: { width: '100%', gap: 4, alignItems: 'center' },
  center: { textAlign: 'center' },
  avatarWrap: { position: 'relative', alignItems: 'center' },
  avatarBadge: { position: 'absolute', right: -2, bottom: -2 },
  actionsButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.62 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  cardHeading: { flex: 1, minWidth: 0, gap: 2 },
  facts: { gap: 12 },
  fact: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusLabel: { flex: 1, minWidth: 0 },
  statusValue: { flexShrink: 0, maxWidth: '62%' },
  statusValueText: { flexShrink: 0, maxWidth: '62%', textAlign: 'right' },
  companionEmpty: { gap: 10 },
  companionActions: { gap: 10, marginTop: 4 },
  contentSection: { gap: 12 },
  reviews: { gap: 10 },
  reviewList: { gap: 10 },
})
