import type { FunctionReturnType } from 'convex/server'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native'
import { api as generatedApi } from '../../../../web/convex/_generated/api'

import { mobileApi, type CircleId, type CircleMembershipId, type CommentId, type PostId, type UserId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Checkbox, TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { PostActionBar } from '@/features/social/PostActionBar'
import { PostCard } from '@/features/social/PostCard'
import { useAppTheme } from '@/theme/ThemeProvider'

import { canRequestCircleMembership, circleAccessPresentation, circleActionError, circleJoinLabel, circleMembershipMessage, circlePreviewSections, circlePrivacySummary, previewDiscussionItems, resolveCirclePrivacySettings, shouldQueryRemovedCircleContent } from './circlePresentation'

type CircleDetail = Exclude<NonNullable<FunctionReturnType<typeof generatedApi.circles.detail>>, { unavailable: true }>
type CirclePost = FunctionReturnType<typeof generatedApi.social.circleFeed>['page'][number]
type WorkspaceTab = 'discussions' | 'about' | 'members' | 'manage'

export function CircleWorkspaceScreen() {
  const params = useLocalSearchParams<{ id: string; postId?: string; commentId?: string }>()
  const circleId = params.id as CircleId
  const detail = useQuery(mobileApi.circles.detail, { circleId })
  if (detail === undefined) return <CircleState loading title="Loading Circle" />
  if (detail.unavailable) return <CircleState title="Circle unavailable" detail="This Circle is not open to members right now." />
  const access = circleAccessPresentation({ unavailable: false, membershipState: detail.membershipState, circleState: detail.circleState, canWrite: detail.canWrite })
  return access === 'preview' ? <CirclePreview detail={detail} circleId={circleId} /> : <MemberCircle detail={detail} circleId={circleId} initialPostId={params.postId} />
}

function CirclePreview({ detail, circleId }: { detail: CircleDetail; circleId: CircleId }) {
  const theme = useAppTheme()
  const requestJoin = useMutation(mobileApi.circles.requestToJoin)
  const cancelJoin = useMutation(mobileApi.circles.cancelJoinRequest)
  const report = useMutation(mobileApi.reports.create)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const canRequest = canRequestCircleMembership(detail.membershipState)

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key); setError('')
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.') } finally { setBusy('') }
  }

  const privacy = circlePrivacySummary(detail.settings ?? detail)
  const sections = circlePreviewSections(detail)
  return <Screen contentStyle={styles.screen}>
    <AppHeader back title={detail.name} subtitle={`${detail.category} · ${detail.memberCount} members`} />
    {detail.coverUrl ? <Image source={{ uri: detail.coverUrl }} style={styles.cover} accessibilityLabel={`${detail.name} Circle cover`} /> : null}
    <View style={styles.hero}>{detail.iconUrl ? <Image source={{ uri: detail.iconUrl }} style={styles.icon} accessibilityLabel={`${detail.name} Circle icon`} /> : null}<AppText variant="title">{detail.name}</AppText><AppText color={theme.colors.textMuted}>{detail.purpose}</AppText><AppText variant="caption" color={theme.colors.textMuted}>Hosted by {detail.host?.displayName ?? 'Circle host'}</AppText></View>
    {error ? <InlineNotice title="Circle action failed" tone="danger">{error}</InlineNotice> : null}
    {circleMembershipMessage(detail.membershipState) ? <InlineNotice title="Membership status" tone={detail.membershipState === 'banned' ? 'danger' : 'neutral'}>{circleMembershipMessage(detail.membershipState)}</InlineNotice> : null}
    <View style={[styles.panel, { borderColor: theme.colors.border }]}><AppText variant="heading">Visibility</AppText><AppText color={theme.colors.textMuted}>{privacy.discoverability}</AppText><AppText color={theme.colors.textMuted}>{privacy.discussion}</AppText><AppText color={theme.colors.textMuted}>{privacy.memberList}</AppText><AppText color={theme.colors.textMuted}>{privacy.join}</AppText></View>
    <View style={[styles.panel, { borderColor: theme.colors.border }]}><AppText variant="heading">Circle rules</AppText>{detail.rules.map((rule, index) => <AppText key={`${index}-${rule}`}>{index + 1}. {rule}</AppText>)}</View>
    {canRequest ? <Checkbox label="I have read and agree to follow these rules." checked={acknowledged} disabled={Boolean(busy)} onChange={setAcknowledged} /> : null}
    {canRequest ? <ActionButton label={circleJoinLabel(detail.joinPolicy, detail.membershipState)} intent="social" loading={busy === 'join'} disabled={!acknowledged || Boolean(busy)} onPress={() => void run('join', () => requestJoin({ circleId, rulesAcknowledged: acknowledged }))} /> : null}
    {detail.membershipState === 'requested' ? <ActionButton label="Cancel request" intent="neutral" secondary loading={busy === 'cancel'} onPress={() => void run('cancel', () => cancelJoin({ circleId }))} /> : null}
    {detail.membershipState !== 'banned' ? <ActionButton label="Report Circle" intent="danger" secondary loading={busy === 'report'} onPress={() => Alert.alert('Report this Circle?', 'A platform safety reviewer will inspect the Circle.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report Circle', style: 'destructive', onPress: () => void run('report', () => report({ targetType: 'circle', targetId: String(circleId), reason: 'Circle needs safety review' })) }])} /> : null}
    {sections.showDiscussions ? <PreviewDiscussions circleId={circleId} /> : null}
    {sections.showMembers ? <PreviewMembers circleId={circleId} /> : null}
  </Screen>
}

function PreviewDiscussions({ circleId }: { circleId: CircleId }) {
  const theme = useAppTheme()
  const feed = usePaginatedQuery(mobileApi.social.circleFeed, { circleId }, { initialNumItems: 10 })
  return <View style={styles.section}>
    <AppText variant="heading">Recent discussions</AppText>
    <AppText color={theme.colors.textMuted}>Visible to signed-in members. Join this Circle to post, react, or comment.</AppText>
    {feed.status === 'LoadingFirstPage' ? <StateView embedded loading title="Loading discussions" /> : feed.results.length === 0 ? <StateView embedded title="No discussions yet" /> : <View style={styles.list}>{previewDiscussionItems(feed.results).map((post) => <View key={post._id} style={[styles.panel, { borderColor: theme.colors.border }]}><AppText variant="bodyStrong">{post.authorDisplayName}</AppText><AppText>{post.body}</AppText></View>)}</View>}
    {feed.status === 'CanLoadMore' ? <ActionButton label="Load more discussions" intent="social" secondary onPress={() => feed.loadMore(10)} /> : null}
  </View>
}

function PreviewMembers({ circleId }: { circleId: CircleId }) {
  const theme = useAppTheme()
  const members = useQuery(mobileApi.circles.members, { circleId })
  return <View style={styles.section}>
    <AppText variant="heading">Members</AppText>
    <AppText color={theme.colors.textMuted}>Active members only. Requests and past members are never shown here.</AppText>
    {members === undefined ? <AppText>Loading members...</AppText> : members.map((member) => <MemberRow key={member.membershipId} name={member.displayName} detail={`${member.username ? `@${member.username} · ` : ''}${member.role}`} />)}
  </View>
}

function MemberCircle({ detail, circleId, initialPostId }: { detail: CircleDetail; circleId: CircleId; initialPostId?: string }) {
  const theme = useAppTheme()
  const [tab, setTab] = useState<WorkspaceTab>('discussions')
  const setMuted = useMutation(mobileApi.circles.setMuted)
  const leave = useMutation(mobileApi.circles.leave)
  const acceptTransfer = useMutation(mobileApi.circles.acceptHostTransfer)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const options = [
    { value: 'discussions' as const, label: 'Posts' },
    { value: 'about' as const, label: 'About' },
    { value: 'members' as const, label: 'Members' },
    ...(detail.isCanonicalHost ? [{ value: 'manage' as const, label: 'Manage' }] : []),
  ]

  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'The Circle action could not be completed.') } finally { setBusy(false) } }

  return <Screen contentStyle={styles.screen}>
    <AppHeader back title={detail.name} subtitle={`${detail.category} · ${detail.memberCount} members`} />
    {detail.coverUrl ? <Image source={{ uri: detail.coverUrl }} style={styles.cover} accessibilityLabel={`${detail.name} Circle cover`} /> : null}
    <View style={styles.hero}>{detail.iconUrl ? <Image source={{ uri: detail.iconUrl }} style={styles.icon} accessibilityLabel={`${detail.name} Circle icon`} /> : null}<AppText color={theme.colors.textMuted}>{detail.purpose}</AppText><View style={styles.row}>{detail.circleState === 'archived' ? <AppText variant="caption" color={theme.colors.warning}>Archived, read-only</AppText> : null}{detail.role !== 'member' ? <AppText variant="caption" color={theme.colors.socialText}>{detail.role}</AppText> : null}{detail.joinPolicy === 'open' ? <AppText variant="caption" color={theme.colors.socialText}>Open join</AppText> : null}</View></View>
    {error ? <InlineNotice title="Circle action failed" tone="danger">{error}</InlineNotice> : null}
    {detail.pendingTransferForViewer ? <InlineNotice title="Host invitation" tone="neutral">You have been invited to host this Circle.<ActionButton label="Accept ownership" intent="neutral" compact onPress={() => Alert.alert('Accept Circle ownership?', 'You will become responsible for membership, rules, and moderation.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Accept ownership', onPress: () => void run(() => acceptTransfer({ circleId })) }])} /></InlineNotice> : null}
    <View style={styles.row}><ActionButton compact label={detail.muted ? 'Unmute' : 'Mute'} intent="neutral" secondary loading={busy} onPress={() => void run(() => setMuted({ circleId, muted: !detail.muted }))} />{!detail.isCanonicalHost ? <ActionButton compact label="Leave Circle" intent="danger" secondary disabled={busy} onPress={() => Alert.alert('Leave this Circle?', 'You will lose access to discussions and the member list.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave Circle', style: 'destructive', onPress: () => void run(() => leave({ circleId })) }])} /> : null}</View>
    <SegmentedControl label="Circle sections" options={options} value={tab} onChange={setTab} tone={tab === 'manage' ? 'self' : 'social'} />
    {tab === 'discussions' ? <CircleDiscussions circleId={circleId} canWrite={detail.canWrite} canModerate={detail.canModerate} initialPostId={initialPostId} /> : null}
    {tab === 'about' ? <CircleAbout detail={detail} circleId={circleId} /> : null}
    {tab === 'members' ? <CircleMembers circleId={circleId} canModerate={detail.canModerate} /> : null}
    {tab === 'manage' && detail.isCanonicalHost ? <CircleManage circleId={circleId} /> : null}
  </Screen>
}

function CircleDiscussions({ circleId, canWrite, canModerate, initialPostId }: { circleId: CircleId; canWrite: boolean; canModerate: boolean; initialPostId?: string }) {
  const theme = useAppTheme()
  const feed = usePaginatedQuery(mobileApi.social.circleFeed, { circleId }, { initialNumItems: 20 })
  const createPost = useMutation(mobileApi.social.createPost)
  const [body, setBody] = useState('')
  const [announcement, setAnnouncement] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedPost, setSelectedPost] = useState<string | null>(initialPostId ?? null)
  useEffect(() => { if (initialPostId && feed.results.some((post) => String(post._id) === initialPostId)) setSelectedPost(initialPostId) }, [feed.results, initialPostId])

  async function publish() {
    if (!body.trim() || busy || !canWrite) return
    setBusy(true); setError('')
    try { await createPost({ body, circleId, circleKind: announcement ? 'announcement' : 'discussion' }); setBody('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'The post could not be published.') } finally { setBusy(false) }
  }

  return <View style={styles.section}>
    {canWrite ? <View style={[styles.panel, { borderColor: theme.colors.border }]}><AppText variant="heading">Start a discussion</AppText><TextField multiline value={body} maxLength={1000} placeholder="Share something with this Circle" onChangeText={setBody} />{canModerate ? <Checkbox label="Post as an announcement" checked={announcement} onChange={setAnnouncement} /> : null}<ActionButton label="Publish" intent="social" loading={busy} disabled={!body.trim()} onPress={() => void publish()} /></View> : <InlineNotice title="Read-only Circle" tone="neutral">Posts, comments, reactions, and saves are unavailable while this Circle is archived.</InlineNotice>}
    {error ? <InlineNotice title="Post action failed" tone="danger">{error}</InlineNotice> : null}
    {feed.status === 'LoadingFirstPage' ? <StateView embedded loading title="Loading discussions" /> : feed.results.length === 0 ? <StateView embedded title="No discussions yet" detail={canWrite ? 'Start the first conversation.' : 'This Circle has no visible posts.'} /> : <View style={styles.list}>{feed.results.map((post) => <CirclePostCard key={post._id} post={post} canWrite={canWrite} canModerate={canModerate} expanded={selectedPost === String(post._id)} onToggleComments={() => setSelectedPost((current) => current === String(post._id) ? null : String(post._id))} />)}</View>}
    {feed.status === 'CanLoadMore' ? <ActionButton label="Load more discussions" intent="social" secondary onPress={() => feed.loadMore(20)} /> : null}
  </View>
}

function CirclePostCard({ post, canWrite, canModerate, expanded, onToggleComments }: { post: CirclePost; canWrite: boolean; canModerate: boolean; expanded: boolean; onToggleComments: () => void }) {
  const theme = useAppTheme()
  const toggleLike = useMutation(mobileApi.social.toggleLike)
  const toggleSave = useMutation(mobileApi.social.toggleSavePost)
  const remove = useMutation(mobileApi.circles.setPostRemoved)
  const report = useMutation(mobileApi.reports.create)
  const [error, setError] = useState('')
  const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(post.createdAt)
  return <View><PostCard author={post.authorDisplayName} username={post.authorUsername} imageUrl={post.authorProfileImageUrl} timestamp={date} meta={post.circleKind === 'announcement' ? <AppText variant="caption" color={theme.colors.socialText}>Announcement</AppText> : null} headerAction={canModerate ? <ActionButton label="Moderate post" compact intent="danger" secondary onPress={() => Alert.alert('Remove this post?', 'Members will no longer see it. The moderation queue can restore it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove post', style: 'destructive', onPress: () => void remove({ postId: post._id as PostId, removed: true }).catch(() => setError('The post could not be removed.')) }])} /> : !post.ownPost ? <ActionButton label="Report post" compact intent="danger" secondary onPress={() => void report({ targetType: 'post', targetId: String(post._id), reason: 'Circle post needs safety review' }).catch(() => setError('The report could not be sent.'))} /> : null} footer={<PostActionBar liked={post.liked} likeCount={post.likeCount} saved={post.saved} commentCount={post.commentCount} disabled={!canWrite} commentLabel="View comments" onLike={() => { if (canWrite) void toggleLike({ postId: post._id as PostId }).catch(() => setError('The reaction could not be updated.')) }} onSave={() => { if (canWrite) void toggleSave({ postId: post._id as PostId }).catch(() => setError('The saved post could not be updated.')) }} onComment={onToggleComments} />}><AppText>{post.body}</AppText></PostCard>{error ? <InlineNotice title="Post action failed" tone="danger">{error}</InlineNotice> : null}{expanded ? <CircleComments postId={post._id as PostId} canWrite={canWrite} canModerate={canModerate} /> : null}</View>
}

function CircleComments({ postId, canWrite, canModerate }: { postId: PostId; canWrite: boolean; canModerate: boolean }) {
  const theme = useAppTheme()
  const comments = useQuery(mobileApi.social.commentsForPost, { postId })
  const create = useMutation(mobileApi.social.createComment)
  const remove = useMutation(mobileApi.circles.setCommentRemoved)
  const report = useMutation(mobileApi.reports.create)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  return <View style={[styles.comments, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>{comments === undefined ? <AppText>Loading comments...</AppText> : comments.length === 0 ? <AppText color={theme.colors.textMuted}>No comments yet.</AppText> : comments.map((comment) => <View key={comment._id} style={styles.comment}><View style={styles.sectionTitle}><AppText variant="bodyStrong">{comment.authorDisplayName}</AppText>{canModerate ? <ActionButton compact label={`Remove ${comment.authorDisplayName}'s comment`} intent="danger" secondary onPress={() => Alert.alert('Remove this comment?', 'Members will no longer see it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove comment', style: 'destructive', onPress: () => void remove({ commentId: comment._id as CommentId, removed: true }).catch(() => setError('The comment could not be removed.')) }])} /> : !comment.ownComment ? <ActionButton compact label="Report comment" intent="danger" secondary onPress={() => void report({ targetType: 'comment', targetId: String(comment._id), reason: 'Circle comment needs safety review' }).catch(() => setError('The report could not be sent.'))} /> : null}</View><AppText>{comment.body}</AppText></View>)}{canWrite ? <View style={styles.row}><TextField style={styles.flex} value={body} maxLength={500} placeholder="Write a comment" onChangeText={setBody} /><ActionButton compact label="Comment" intent="social" disabled={!body.trim()} onPress={() => void create({ postId, body }).then(() => setBody('')).catch(() => setError('The comment could not be posted.'))} /></View> : null}{error ? <AppText color={theme.colors.danger}>{error}</AppText> : null}</View>
}

function CircleAbout({ detail, circleId }: { detail: CircleDetail; circleId: CircleId }) {
  const report = useMutation(mobileApi.reports.create)
  const [error, setError] = useState('')
  async function reportCircle() {
    setError('')
    try {
      await report({ targetType: 'circle', targetId: String(circleId), reason: 'Circle needs safety review' })
    } catch (cause) {
      setError(circleActionError(cause, 'The Circle report could not be sent.'))
    }
  }
  return <View style={styles.section}><AppText variant="heading">Purpose</AppText><AppText>{detail.purpose}</AppText><AppText variant="heading">Circle rules</AppText>{detail.rules.map((rule, index) => <AppText key={`${index}-${rule}`}>{index + 1}. {rule}</AppText>)}{error ? <InlineNotice title="Circle report failed" tone="danger">{error}</InlineNotice> : null}{detail.circleState === 'active' ? <ActionButton label="Report Circle" intent="danger" secondary onPress={() => void reportCircle()} /> : null}</View>
}

function CircleMembers({ circleId, canModerate }: { circleId: CircleId; canModerate: boolean }) {
  const theme = useAppTheme()
  const members = useQuery(mobileApi.circles.members, { circleId })
  const requests = useQuery(mobileApi.circles.joinRequests, canModerate ? { circleId } : 'skip')
  const decide = useMutation(mobileApi.circles.decideJoinRequest)
  const moderate = useMutation(mobileApi.circles.moderateMember)
  const [error, setError] = useState('')
  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(circleActionError(cause, 'The member action could not be completed.'))
    }
  }
  return <View style={styles.section}>{error ? <InlineNotice title="Member action failed" tone="danger">{error}</InlineNotice> : null}{canModerate ? <><AppText variant="heading">Join requests</AppText>{requests === undefined ? <AppText>Loading requests...</AppText> : requests.length === 0 ? <AppText color={theme.colors.textMuted}>No pending requests.</AppText> : requests.map((request) => <MemberRow key={request.membershipId} name={request.displayName} detail={request.username ? `@${request.username}` : 'Member'} actions={<View style={styles.row}><ActionButton compact label={`Approve ${request.displayName}`} intent="neutral" onPress={() => void run(() => decide({ membershipId: request.membershipId as CircleMembershipId, decision: 'approve' }))} /><ActionButton compact label={`Reject ${request.displayName}`} intent="danger" secondary onPress={() => Alert.alert(`Reject ${request.displayName}?`, 'They can request to join again later.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reject request', style: 'destructive', onPress: () => void run(() => decide({ membershipId: request.membershipId as CircleMembershipId, decision: 'reject' })) }])} /></View>} />)}</> : null}<AppText variant="heading">Members</AppText>{members === undefined ? <AppText>Loading members...</AppText> : members.map((member) => <MemberRow key={member.membershipId} name={member.displayName} detail={`${member.username ? `@${member.username} · ` : ''}${member.role}`} actions={canModerate && member.role === 'member' ? <View style={styles.row}><ActionButton compact label={`Remove ${member.displayName}`} intent="danger" secondary onPress={() => Alert.alert(`Remove ${member.displayName}?`, 'They lose access but can request to join again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove member', style: 'destructive', onPress: () => void run(() => moderate({ membershipId: member.membershipId as CircleMembershipId, action: 'remove' })) }])} /><ActionButton compact label={`Ban ${member.displayName}`} intent="danger" secondary onPress={() => Alert.alert(`Ban ${member.displayName}?`, 'They lose access and cannot request to join until the host unbans them.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Ban member', style: 'destructive', onPress: () => void run(() => moderate({ membershipId: member.membershipId as CircleMembershipId, action: 'ban' })) }])} /></View> : undefined} />)}</View>
}

function MemberRow({ name, detail, actions }: { name: string; detail: string; actions?: React.ReactNode }) { const theme = useAppTheme(); return <View style={[styles.member, { borderColor: theme.colors.border }]}><View style={styles.flex}><AppText variant="bodyStrong">{name}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{detail}</AppText></View>{actions}</View> }

function CircleManage({ circleId }: { circleId: CircleId }) {
  const theme = useAppTheme()
  const management = useQuery(mobileApi.circles.hostManagement, { circleId })
  const edit = useMutation(mobileApi.circles.edit)
  const updateSettings = useMutation(mobileApi.circles.updateSettings)
  const setModerator = useMutation(mobileApi.circles.setModerator)
  const unban = useMutation(mobileApi.circles.unbanMember)
  const transfer = useMutation(mobileApi.circles.initiateHostTransfer)
  const cancelTransfer = useMutation(mobileApi.circles.cancelHostTransfer)
  const setState = useMutation(mobileApi.circles.setState)
  const removed = useQuery(mobileApi.circles.removedContent, shouldQueryRemovedCircleContent(management?.circle.state) ? { circleId } : 'skip')
  const restorePost = useMutation(mobileApi.circles.setPostRemoved)
  const restoreComment = useMutation(mobileApi.circles.setCommentRemoved)
  const [form, setForm] = useState<{ name: string; purpose: string; category: string; rules: string; mode: 'online' | 'in_person' | 'both'; approximateArea: string } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { if (management && !form) setForm({ ...management.circle, rules: management.circle.rules.join('\n'), approximateArea: management.circle.approximateArea ?? '' }) }, [form, management])
  if (management === undefined || !form) return <StateView embedded loading title="Loading Circle management" />
  const act = (action: Promise<unknown>) => void action.catch((cause) => setError(cause instanceof Error ? cause.message : 'The setting could not be updated.'))
  const privacy = resolveCirclePrivacySettings(management.circle.settings)
  return <View style={styles.section}>{error ? <InlineNotice title="Management action failed" tone="danger">{error}</InlineNotice> : null}<View style={[styles.panel, { borderColor: theme.colors.border }]}><AppText variant="heading">Privacy settings</AppText><AppText color={theme.colors.textMuted}>Listed Circles appear in Discover. Unlisted Circles stay reachable by direct link. Signed-in visibility lets eligible members read before joining. Only active members can post or moderate.</AppText><PrivacyChoice label="Discoverability" options={[{ value: 'listed', label: 'Listed' }, { value: 'unlisted', label: 'Unlisted' }]} value={privacy.discoverability} disabled={management.circle.state !== 'active'} onChange={(discoverability) => act(updateSettings({ circleId, discoverability, discussionVisibility: privacy.discussionVisibility, memberListVisibility: privacy.memberListVisibility, joinPolicy: privacy.joinPolicy }))} /><PrivacyChoice label="Discussions" options={[{ value: 'members_only', label: 'Members only' }, { value: 'signed_in', label: 'Signed-in' }]} value={privacy.discussionVisibility} disabled={management.circle.state !== 'active'} onChange={(discussionVisibility) => act(updateSettings({ circleId, discoverability: privacy.discoverability, discussionVisibility, memberListVisibility: privacy.memberListVisibility, joinPolicy: privacy.joinPolicy }))} /><PrivacyChoice label="Member list" options={[{ value: 'members_only', label: 'Members only' }, { value: 'signed_in', label: 'Signed-in' }]} value={privacy.memberListVisibility} disabled={management.circle.state !== 'active'} onChange={(memberListVisibility) => act(updateSettings({ circleId, discoverability: privacy.discoverability, discussionVisibility: privacy.discussionVisibility, memberListVisibility, joinPolicy: privacy.joinPolicy }))} /><PrivacyChoice label="Join policy" options={[{ value: 'approval_required', label: 'Approval' }, { value: 'open', label: 'Open' }]} value={privacy.joinPolicy} disabled={management.circle.state !== 'active'} onChange={(joinPolicy) => act(updateSettings({ circleId, discoverability: privacy.discoverability, discussionVisibility: privacy.discussionVisibility, memberListVisibility: privacy.memberListVisibility, joinPolicy }))} /></View>
    <View style={[styles.panel, { borderColor: theme.colors.border }]}><AppText variant="heading">Circle images</AppText>{management.circle.iconUrl || management.circle.coverUrl ? <AppText color={theme.colors.textMuted}>This Circle has custom images.</AppText> : <AppText color={theme.colors.textMuted}>No custom images yet.</AppText>}<AppText color={theme.colors.textMuted}>Circle icon and cover editing is available on web only.</AppText></View>
    <View style={[styles.panel, { borderColor: theme.colors.border }]}><AppText variant="heading">Circle settings</AppText><LabeledField label="Name"><TextField value={form.name} maxLength={80} onChangeText={(name) => setForm({ ...form, name })} /></LabeledField><LabeledField label="Purpose"><TextField multiline value={form.purpose} maxLength={500} onChangeText={(purpose) => setForm({ ...form, purpose })} /></LabeledField><LabeledField label="Category"><TextField value={form.category} maxLength={60} onChangeText={(category) => setForm({ ...form, category })} /></LabeledField><LabeledField label="Approximate area"><TextField value={form.approximateArea} maxLength={80} onChangeText={(approximateArea) => setForm({ ...form, approximateArea })} /></LabeledField><LabeledField label="Rules"><TextField multiline value={form.rules} onChangeText={(rules) => setForm({ ...form, rules })} /></LabeledField><View style={styles.row}>{(['online', 'in_person', 'both'] as const).map((mode) => <ActionButton key={mode} compact label={mode === 'in_person' ? 'In person' : mode === 'both' ? 'Both' : 'Online'} intent="self" secondary={form.mode !== mode} onPress={() => setForm({ ...form, mode })} />)}</View><ActionButton label="Save settings" intent="self" disabled={management.circle.state !== 'active'} onPress={() => act(edit({ circleId, ...form, approximateArea: form.approximateArea.trim() || undefined, rules: form.rules.split('\n').map((rule) => rule.trim()).filter(Boolean) }))} /></View>
    <AppText variant="heading">Roles and ownership</AppText>{management.pendingTransfer ? <InlineNotice title="Ownership transfer pending" tone="neutral">Offered to {management.pendingTransfer.displayName}.<ActionButton compact label="Cancel ownership transfer" intent="neutral" disabled={management.circle.state !== 'active'} onPress={() => Alert.alert('Cancel ownership transfer?', 'The recipient will no longer be able to accept it.', [{ text: 'Keep transfer', style: 'cancel' }, { text: 'Cancel transfer', onPress: () => act(cancelTransfer({ circleId })) }])} /></InlineNotice> : null}{management.activeMembers.filter((member) => member.role !== 'host').map((member) => <MemberRow key={member.membershipId} name={member.displayName} detail={`${member.username ? `@${member.username} · ` : ''}${member.role}`} actions={<View style={styles.row}>{member.role === 'moderator' ? <ActionButton compact label={`Remove ${member.displayName} as moderator`} intent="neutral" secondary disabled={management.circle.state !== 'active'} onPress={() => Alert.alert(`Remove ${member.displayName} as moderator?`, 'They keep Circle membership but lose moderation access.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove moderator', onPress: () => act(setModerator({ membershipId: member.membershipId as CircleMembershipId, moderator: false })) }])} /> : <ActionButton compact label={`Make ${member.displayName} a moderator`} intent="neutral" disabled={!member.trustedRoleEligible || management.circle.state !== 'active'} onPress={() => act(setModerator({ membershipId: member.membershipId as CircleMembershipId, moderator: true }))} />}{member.trustedRoleEligible && !management.pendingTransfer && management.circle.state === 'active' ? <ActionButton compact label={`Offer ownership to ${member.displayName}`} intent="neutral" secondary onPress={() => Alert.alert(`Offer ownership to ${member.displayName}?`, 'They must accept before your host role changes.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Offer ownership', onPress: () => act(transfer({ circleId, recipientUserId: member.userId as UserId })) }])} /> : null}</View>} />)}
    <AppText variant="heading">Banned members</AppText>{management.bannedMembers.length === 0 ? <AppText color={theme.colors.textMuted}>No banned members.</AppText> : management.bannedMembers.map((member) => <MemberRow key={member.membershipId} name={member.displayName} detail={member.username ? `@${member.username}` : 'Member'} actions={<ActionButton compact label={`Unban ${member.displayName}`} intent="neutral" disabled={management.circle.state !== 'active'} onPress={() => Alert.alert(`Unban ${member.displayName}?`, 'They can request to join again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Unban member', onPress: () => act(unban({ membershipId: member.membershipId as CircleMembershipId })) }])} />} />)}
    <AppText variant="heading">Removed content</AppText>{management.circle.state !== 'active' ? <AppText color={theme.colors.textMuted}>Reactivate this Circle to review and restore removed content.</AppText> : removed === undefined ? <AppText>Loading removed content...</AppText> : removed.length === 0 ? <AppText color={theme.colors.textMuted}>No removed content.</AppText> : removed.map((item) => <MemberRow key={`${item.kind}-${item.id}`} name={item.kind === 'post' ? 'Removed post' : 'Removed comment'} detail={item.body} actions={<ActionButton compact label={`Restore ${item.kind}`} intent="neutral" onPress={() => act(item.kind === 'post' ? restorePost({ postId: item.id as PostId, removed: false }) : restoreComment({ commentId: item.id as CommentId, removed: false }))} />} />)}
    <AppText variant="heading">Circle lifecycle</AppText><ActionButton label={management.circle.state === 'archived' ? 'Reactivate Circle' : 'Archive Circle'} intent={management.circle.state === 'archived' ? 'self' : 'danger'} secondary={management.circle.state !== 'archived'} onPress={() => { const state = management.circle.state === 'archived' ? 'active' : 'archived'; Alert.alert(state === 'archived' ? 'Archive this Circle?' : 'Reactivate this Circle?', state === 'archived' ? 'Members keep read-only access until you reactivate it.' : 'Members can post and manage requests again.', [{ text: 'Cancel', style: 'cancel' }, { text: state === 'archived' ? 'Archive Circle' : 'Reactivate Circle', style: state === 'archived' ? 'destructive' : 'default', onPress: () => act(setState({ circleId, state })) }]) }} />
  </View>
}

function PrivacyChoice<T extends string>({ label, options, value, disabled, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T; disabled?: boolean; onChange: (value: T) => void }) {
  return <View style={styles.field}><AppText variant="label">{label.toUpperCase()}</AppText><View style={styles.row}>{options.map((option) => <ActionButton key={option.value} compact label={option.label} intent="self" secondary={value !== option.value} disabled={disabled} onPress={() => { if (value !== option.value) onChange(option.value) }} />)}</View></View>
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><AppText variant="label">{label.toUpperCase()}</AppText>{children}</View> }
function CircleState({ title, detail, loading = false }: { title: string; detail?: string; loading?: boolean }) { return <Screen contentStyle={styles.center}><StateView eyebrow="CIRCLES" title={title} detail={detail} loading={loading} actionLabel={loading ? undefined : 'Back to Circles'} onAction={loading ? undefined : () => router.replace('/circles' as never)} /></Screen> }

const styles = StyleSheet.create({
  screen: { gap: 14 }, center: { flexGrow: 1, justifyContent: 'center' }, hero: { gap: 5 }, section: { gap: 12 }, panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 10 }, list: { gap: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, flex: { flex: 1, minWidth: 0 }, field: { gap: 5 }, comments: { borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 }, comment: { gap: 3 }, member: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 8 }, sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cover: { width: '100%', aspectRatio: 4, borderRadius: 16 },
  icon: { width: 56, height: 56, borderRadius: 28 },
})
