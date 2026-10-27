import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { formatPhp } from '@lets-be-friends/shared'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
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
import { typography } from '@/theme/tokens'

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
      <View style={[styles.header, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerTop}>
          <View style={styles.avatarWrap}>
            <Avatar uri={imageUrl} name={displayName} size={72} />
            {fullyVerified ? (
              <View style={styles.avatarBadge}>
                <VerifiedBadge label="Identity and Companion profile verified" />
              </View>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <IconButton label="Open settings" icon="settings-outline" tone="self" onPress={onOpenSettings} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile actions"
              accessibilityHint="Edit profile, bookings, and Companion profile options"
              onPress={() => setActionsOpen(true)}
              style={({ pressed }) => [styles.actionsButton, { borderColor: theme.colors.border }, pressed && styles.pressed]}>
              <AppIcon name="ellipsis-horizontal" color={theme.colors.text} size={22} />
            </Pressable>
          </View>
        </View>
        <View style={styles.identityCopy}>
          <AppText style={styles.profileName}>{displayName}</AppText>
          {username ? <AppText style={styles.profileMeta} color={theme.colors.textMuted}>{username}</AppText> : null}
          <AppText style={styles.profileMeta} color={theme.colors.textMuted}>{memberSince} · {roleLabel}</AppText>
        </View>
      </View>

      <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
        <AppText style={styles.sectionTitle}>About</AppText>
        <AppText style={styles.profileBody}>{bio || 'No bio added yet.'}</AppText>
        {interests.length > 0 ? (
          <View style={styles.fact}>
            <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>INTERESTED IN</AppText>
            <View style={styles.tagList}>
              {interests.map((interest) => (
                <View key={interest} style={[styles.profileTag, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                  <AppText style={styles.profileTagText}>{interest}</AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
        <AppText style={styles.sectionTitle}>Account status</AppText>
        <View style={styles.statusRow}>
          <AppText style={styles.statusMeta} color={theme.colors.textMuted}>Identity verification</AppText>
          <View style={styles.statusValue}>
            <StatusBadge label={verificationLabel} tone={verificationApproved ? 'success' : verificationLabel.includes('pending') || verificationLabel.includes('Pending') ? 'warning' : 'self'} />
          </View>
        </View>
        <AppText style={styles.profileBody} color={theme.colors.textMuted}>{verificationDetail}</AppText>
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
          <AppText style={styles.statusMeta} color={theme.colors.textMuted}>Discovery area</AppText>
          <AppText style={styles.statusMetaValue} color={theme.colors.textMuted}>{discoveryArea || 'Not saved'}</AppText>
        </View>
        <AppText style={styles.profileMeta} color={theme.colors.textMuted}>
          Rounded device location Nearby uses for distances, to two decimals. An approved Companion profile also appears on the nearby map here.
        </AppText>
        {!companion ? (
          <View style={styles.companionEmpty}>
            <View style={styles.statusRow}>
              <AppText style={styles.statusMeta} color={theme.colors.textMuted}>Companion profile</AppText>
              <View style={styles.statusValue}>
                <StatusBadge label={companionStatusLabel('not started')} tone={companionStatusTone('not started')} />
              </View>
            </View>
            <AppText style={styles.profileBody} color={theme.colors.textMuted}>
              A Companion profile adds the session format, area, listed rate, and everyday help you want to offer.
            </AppText>
            <ActionButton label="Become a Companion" onPress={onOpenCompanion} intent="self" secondary />
          </View>
        ) : null}
      </View>

      {companion ? (
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
          <View style={styles.statusRow}>
            <View style={styles.cardHeading}>
              <AppText style={styles.sectionTitle}>Companion profile</AppText>
            </View>
            <View style={styles.statusValue}>
              <StatusBadge label={companionStatusLabel(companion.status)} tone={companionStatusTone(companion.status)} />
            </View>
          </View>
          <View style={styles.facts}>
            <View style={styles.fact}>
              <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>WHAT YOU OFFER</AppText>
              <AppText style={styles.profileBody}>{companion.intro}</AppText>
            </View>
            {companion.categories.length > 0 ? (
              <View style={styles.fact}>
                <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>EVERYDAY HELP AND ACTIVITIES</AppText>
                <View style={styles.tagList}>
                  {companion.categories.map((category) => (
                    <View key={category} style={[styles.profileTag, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                      <AppText style={styles.profileTagText}>{category}</AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {companion.strengths.length > 0 ? (
              <View style={styles.fact}>
                <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>STRENGTHS</AppText>
                <View style={styles.tagList}>
                  {companion.strengths.map((strength) => (
                    <View key={strength} style={[styles.profileTag, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                      <AppText style={styles.profileTagText}>{strength}</AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {companion.boundaries.length > 0 ? (
              <View style={styles.fact}>
                <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>BOUNDARIES</AppText>
                {companion.boundaries.map((boundary) => <AppText key={boundary} style={styles.profileBody}>· {boundary}</AppText>)}
              </View>
            ) : null}
            <View style={styles.fact}>
              <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>SESSION FORMAT</AppText>
              <AppText style={styles.profileBody}>{companionModeLabel(companion.mode)}</AppText>
            </View>
            <View style={styles.fact}>
              <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>AREA MEMBERS READ</AppText>
              <AppText style={styles.profileBody}>{companion.city || 'Not set'}</AppText>
            </View>
            <View style={styles.fact}>
              <AppText style={styles.fieldLabel} color={theme.colors.textMuted}>LISTED HOURLY RATE</AppText>
              <AppText style={styles.profileBody}>{typeof companion.hourlyRateCentavos === 'number' ? `${formatPhp(companion.hourlyRateCentavos)} per hour` : 'Not set'}</AppText>
            </View>
          </View>
          {companion.status === 'approved' && !companion.publicProfileId ? (
            <AppText style={styles.profileMeta} color={theme.colors.textMuted}>
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
            <AppText style={styles.sectionTitle}>Reviews of your Companion profile</AppText>
            {typeof rating === 'number' && typeof reviewCount === 'number' ? (
              <AppText style={styles.profileMeta} color={theme.colors.textMuted} accessibilityLabel={`${rating.toFixed(1)} out of 5 from ${reviewCount} reviews`}>
                {rating.toFixed(1)} out of 5 from {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
              </AppText>
            ) : null}
            {reviewsStatus === 'loading' ? (
              <AppText style={styles.profileMeta} color={theme.colors.textMuted}>Loading reviews.</AppText>
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
  header: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  headerTop: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identityCopy: { width: '100%', minWidth: 0, gap: 2 },
  profileName: { ...typography.title },
  profileMeta: { ...typography.caption },
  headerActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  avatarWrap: { position: 'relative', alignItems: 'center', flexShrink: 0 },
  avatarBadge: { position: 'absolute', right: -2, bottom: -2 },
  actionsButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.62 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  cardHeading: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { ...typography.heading },
  profileBody: { ...typography.body },
  fieldLabel: { ...typography.label },
  profileTagText: { ...typography.caption },
  facts: { gap: 12 },
  fact: { gap: 6 },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusMeta: { flex: 1, minWidth: 0, ...typography.caption },
  statusValue: { flexShrink: 0, maxWidth: '62%' },
  statusMetaValue: { flexShrink: 1, minWidth: 0, maxWidth: '62%', textAlign: 'right', ...typography.caption },
  companionEmpty: { gap: 10 },
  companionActions: { gap: 10, marginTop: 4 },
  contentSection: { gap: 12 },
  reviews: { gap: 10 },
  reviewList: { gap: 10 },
})
