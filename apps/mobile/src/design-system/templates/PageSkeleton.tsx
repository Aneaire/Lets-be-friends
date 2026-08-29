import { StyleSheet, View } from 'react-native'

import { Skeleton } from '@/design-system/atoms/Skeleton'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export const pageSkeletonVariants = [
  'auth',
  'onboarding',
  'explore',
  'messages',
  'conversation',
  'bookings',
  'bookingDetail',
  'bookingForm',
  'profile',
  'profileForm',
  'publicProfile',
  'companionTools',
  'finance',
  'notifications',
  'wallet',
] as const

export type PageSkeletonVariant = typeof pageSkeletonVariants[number]

const pageSkeletonLabels: Record<PageSkeletonVariant, string> = {
  auth: 'Loading sign in',
  onboarding: 'Loading account setup',
  explore: 'Loading Explore',
  messages: 'Loading conversations',
  conversation: 'Loading messages',
  bookings: 'Loading bookings',
  bookingDetail: 'Loading booking details',
  bookingForm: 'Loading booking form',
  profile: 'Loading your profile',
  profileForm: 'Loading profile form',
  publicProfile: 'Loading public profile',
  companionTools: 'Loading Companion tools',
  finance: 'Loading Companion finance',
  notifications: 'Loading notifications',
  wallet: 'Loading booking wallet',
}

export function pageSkeletonLabel(variant: PageSkeletonVariant) {
  return pageSkeletonLabels[variant]
}

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={pageSkeletonLabel(variant)}
        accessibilityState={{ busy: true }}
        style={styles.page}>
        <PageSkeletonBody variant={variant} />
      </View>
    </Screen>
  )
}

function PageSkeletonBody({ variant }: { variant: PageSkeletonVariant }) {
  switch (variant) {
    case 'auth':
      return <AuthSkeleton />
    case 'onboarding':
      return <OnboardingSkeleton />
    case 'explore':
      return <ExploreSkeleton />
    case 'messages':
      return <MessagesSkeleton />
    case 'conversation':
      return <ConversationSkeleton />
    case 'bookings':
      return <BookingsSkeleton />
    case 'bookingDetail':
      return <BookingDetailSkeleton />
    case 'bookingForm':
      return <BookingFormSkeleton />
    case 'profile':
      return <ProfileSkeleton />
    case 'profileForm':
      return <ProfileFormSkeleton />
    case 'publicProfile':
      return <PublicProfileSkeleton />
    case 'companionTools':
      return <CompanionToolsSkeleton />
    case 'finance':
      return <FinanceSkeleton />
    case 'notifications':
      return <NotificationsSkeleton />
    case 'wallet':
      return <WalletSkeleton />
  }
}

function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <View style={styles.header}>
      <Skeleton width={40} height={40} radius={14} />
      <Skeleton width="42%" height={20} />
      {action ? <Skeleton width={40} height={40} radius={14} /> : <View style={styles.headerSpacer} />}
    </View>
  )
}

function TitleSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.titleStack}>
      <Skeleton width={compact ? '44%' : '58%'} height={compact ? 22 : 30} radius={10} />
      <Skeleton width="88%" height={14} radius={7} />
      {!compact ? <Skeleton width="68%" height={14} radius={7} /> : null}
    </View>
  )
}

function FieldSkeleton({ short = false }: { short?: boolean }) {
  return (
    <View style={styles.field}>
      <Skeleton width={short ? '28%' : '42%'} height={12} radius={6} />
      <Skeleton height={48} radius={14} />
    </View>
  )
}

function SegmentSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.segment}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width={`${Math.floor(100 / count) - 3}%`} height={36} radius={12} />
      ))}
    </View>
  )
}

function IdentitySkeleton({ large = false, action = false }: { large?: boolean; action?: boolean }) {
  const size = large ? 88 : 52
  return (
    <View style={styles.identity}>
      <Skeleton width={size} height={size} radius={size / 2} />
      <View style={styles.identityCopy}>
        <Skeleton width="54%" height={large ? 24 : 17} />
        <Skeleton width="38%" height={12} />
        {large ? <Skeleton width="76%" height={12} /> : null}
      </View>
      {action ? <Skeleton width={36} height={36} radius={12} /> : null}
    </View>
  )
}

export function ListRowsSkeleton({ count = 4, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.listRow}>
          {avatar ? <Skeleton width={46} height={46} radius={23} /> : null}
          <View style={styles.listCopy}>
            <Skeleton width={index % 2 ? '48%' : '62%'} height={16} />
            <Skeleton width={index % 2 ? '78%' : '88%'} height={12} />
          </View>
          <Skeleton width={28} height={12} radius={6} />
        </View>
      ))}
    </View>
  )
}

function CardRows({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.cards}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardHeader}>
            <Skeleton width={42} height={42} radius={21} />
            <View style={styles.listCopy}>
              <Skeleton width={index % 2 ? '46%' : '58%'} height={16} />
              <Skeleton width="34%" height={12} />
            </View>
          </View>
          <Skeleton width="86%" height={16} />
          <Skeleton width="64%" height={14} />
          <View style={styles.cardActions}>
            <Skeleton width="31%" height={38} radius={12} />
            <Skeleton width="31%" height={38} radius={12} />
          </View>
        </View>
      ))}
    </View>
  )
}

function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <View style={styles.section}>
      <Skeleton width="48%" height={20} />
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.sectionRow}>
          <Skeleton width="32%" height={12} />
          <Skeleton width={index % 2 ? '62%' : '74%'} height={15} />
        </View>
      ))}
    </View>
  )
}

function AuthSkeleton() {
  return (
    <View style={styles.auth}>
      <View style={styles.brandMark}><Skeleton width={54} height={54} radius={18} /></View>
      <TitleSkeleton />
      <View style={styles.form}>
        <Skeleton height={50} radius={14} />
        <Skeleton height={50} radius={14} />
        <Skeleton width="58%" height={13} style={styles.centered} />
      </View>
    </View>
  )
}

function OnboardingSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.stepRow}>
        <Skeleton width="24%" height={13} />
        <Skeleton width="18%" height={13} />
      </View>
      <Skeleton height={4} radius={2} />
      <TitleSkeleton />
      <FieldSkeleton />
      <FieldSkeleton short />
      <Skeleton height={50} radius={14} />
    </View>
  )
}

function ExploreSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.titleRow}><TitleSkeleton /><Skeleton width={58} height={40} radius={12} /></View>
      <Skeleton height={48} radius={14} />
      <View style={styles.chips}><Skeleton width={116} height={36} radius={18} /><Skeleton width={92} height={36} radius={18} /></View>
      <Skeleton width="32%" height={16} />
      <CardRows />
    </View>
  )
}

function MessagesSkeleton() {
  return <View style={styles.stack}><TitleSkeleton /><ListRowsSkeleton count={6} /></View>
}

function ConversationSkeleton() {
  return (
    <View style={styles.fillStack}>
      <HeaderSkeleton action />
      <View style={styles.messageList}>
        <Skeleton width="68%" height={62} radius={16} />
        <Skeleton width="74%" height={84} radius={16} style={styles.outgoing} />
        <Skeleton width="58%" height={62} radius={16} />
        <Skeleton width="66%" height={70} radius={16} style={styles.outgoing} />
      </View>
      <View style={styles.composer}>
        <Skeleton width="12%" height={42} radius={14} />
        <Skeleton width="70%" height={42} radius={14} />
        <Skeleton width="12%" height={42} radius={14} />
      </View>
    </View>
  )
}

function BookingsSkeleton() {
  return <View style={styles.stack}><TitleSkeleton /><SegmentSkeleton /><CardRows /></View>
}

function BookingDetailSkeleton() {
  return (
    <View style={styles.stack}>
      <HeaderSkeleton />
      <TitleSkeleton compact />
      <View style={styles.statusRow}><Skeleton width={88} height={30} radius={15} /><Skeleton width={82} height={16} /></View>
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={2} />
      <Skeleton height={48} radius={14} />
    </View>
  )
}

function BookingFormSkeleton() {
  return (
    <View style={styles.stack}>
      <HeaderSkeleton />
      <TitleSkeleton compact />
      <FieldSkeleton />
      <FieldSkeleton short />
      <FieldSkeleton />
      <View style={styles.summary}><Skeleton width="42%" height={15} /><Skeleton width="24%" height={18} /></View>
      <Skeleton height={50} radius={14} />
    </View>
  )
}

function ProfileSkeleton() {
  return (
    <View style={styles.stack}>
      <TitleSkeleton />
      <IdentitySkeleton large action />
      <View style={styles.twoActions}><Skeleton height={44} radius={14} style={styles.flex} /><Skeleton height={44} radius={14} style={styles.flex} /></View>
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={2} />
    </View>
  )
}

function ProfileFormSkeleton() {
  return (
    <View style={styles.stack}>
      <HeaderSkeleton />
      <View style={styles.avatarEdit}><Skeleton width={88} height={88} radius={44} /><Skeleton width={102} height={36} radius={12} /></View>
      <FieldSkeleton short />
      <FieldSkeleton />
      <FieldSkeleton />
      <Skeleton height={50} radius={14} />
    </View>
  )
}

function PublicProfileSkeleton() {
  return (
    <View style={styles.stack}>
      <HeaderSkeleton action />
      <IdentitySkeleton large />
      <Skeleton width="82%" height={22} />
      <Skeleton width="94%" height={14} />
      <Skeleton width="72%" height={14} />
      <View style={styles.twoActions}><Skeleton height={44} radius={14} style={styles.flex} /><Skeleton height={44} radius={14} style={styles.flex} /></View>
      <View style={styles.chips}><Skeleton width={84} height={34} radius={17} /><Skeleton width={108} height={34} radius={17} /><Skeleton width={76} height={34} radius={17} /></View>
      <SegmentSkeleton count={2} />
      <CardRows count={1} />
    </View>
  )
}

function CompanionToolsSkeleton() {
  return (
    <View style={styles.stack}>
      <TitleSkeleton />
      <View style={styles.heroCard}><Skeleton width="36%" height={13} /><Skeleton width="72%" height={24} /><Skeleton width="88%" height={14} /><Skeleton height={44} radius={14} /></View>
      <CardRows count={2} />
    </View>
  )
}

function FinanceSkeleton() {
  return (
    <View style={styles.stack}>
      <HeaderSkeleton />
      <TitleSkeleton compact />
      <View style={styles.balanceCard}><Skeleton width="36%" height={13} /><Skeleton width="54%" height={34} /><Skeleton width="76%" height={13} /></View>
      <View style={styles.metricRow}><SectionSkeleton rows={1} /><SectionSkeleton rows={1} /></View>
      <ListRowsSkeleton count={3} avatar={false} />
    </View>
  )
}

function NotificationsSkeleton() {
  return (
    <View style={styles.stack}>
      <HeaderSkeleton action />
      <NotificationListSkeleton />
    </View>
  )
}

export function NotificationListSkeleton() {
  return (
    <View accessibilityLabel="Loading notification activity" style={styles.notificationList}>
      <Skeleton width="34%" height={13} />
      <ListRowsSkeleton count={5} />
    </View>
  )
}

export function ProfileContentSkeleton() {
  return <CardRows count={2} />
}

function WalletSkeleton() {
  return (
    <View style={styles.stack}>
      <HeaderSkeleton />
      <TitleSkeleton compact />
      <View style={styles.balanceCard}><Skeleton width="36%" height={13} /><Skeleton width="48%" height={34} /><Skeleton width="82%" height={13} /><Skeleton height={44} radius={14} /></View>
      <SegmentSkeleton count={2} />
      <ListRowsSkeleton count={3} avatar={false} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: density.screenGutter, paddingBottom: density.screenBottom },
  page: { flex: 1 },
  stack: { flex: 1, gap: density.contentGap, paddingTop: 14 },
  fillStack: { flex: 1, gap: density.contentGap },
  flex: { flex: 1 },
  centered: { alignSelf: 'center' },
  header: { minHeight: density.controlHeight + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: density.cardGap },
  headerSpacer: { width: 40 },
  titleStack: { flex: 1, gap: density.textStackGap },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: density.cardGap },
  field: { gap: 7 },
  form: { gap: density.cardGap, marginTop: density.contentGap },
  segment: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 6 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityCopy: { flex: 1, gap: 7 },
  list: { gap: 0 },
  listRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: density.cardGap },
  listCopy: { flex: 1, gap: 7 },
  cards: { gap: 10 },
  card: { gap: 10, padding: density.compactCardPadding },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: density.cardGap },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  section: { flex: 1, gap: density.cardGap },
  sectionRow: { gap: 5 },
  auth: { flex: 1, justifyContent: 'center', gap: density.contentGap, paddingBottom: 48 },
  brandMark: { alignItems: 'flex-start', marginBottom: 4 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  messageList: { flex: 1, justifyContent: 'flex-end', gap: 14, paddingVertical: 12 },
  outgoing: { alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  twoActions: { flexDirection: 'row', gap: 8 },
  avatarEdit: { alignItems: 'center', gap: 10 },
  heroCard: { gap: 10, padding: density.cardPadding },
  balanceCard: { gap: 8, padding: density.cardPadding },
  metricRow: { flexDirection: 'row', gap: density.cardGap },
  notificationList: { gap: density.cardGap },
})
