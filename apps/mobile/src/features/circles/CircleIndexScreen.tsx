import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { useLayoutEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Checkbox, TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'

import { CircleCard } from './CircleCard'
import { CirclePreviewCard } from './CirclePreviewCard'
import { circleActionError, circleIndexPresentation } from './circlePresentation'
import {
  CircleDraftController,
  emptyCircleCreationDraft,
} from './circleCreationDraft'
import { getCircleDraftStorage } from './circleDraftStorage'
import { useMobileMember } from '@/member/MobileMember'

const pilotRules = [
  'Treat every member with respect.',
  'Keep private locations and personal details out of posts.',
  'Use the existing booking flow for paid Companion experiences.',
]

export function CircleIndexScreen() {
  const theme = useAppTheme()
  const mine = useQuery(mobileApi.circles.mine)
  const discover = useQuery(mobileApi.circles.discover)
  const eligibility = useQuery(mobileApi.circles.creationEligibility)
  const create = useMutation(mobileApi.circles.create)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', slug: '', purpose: '', category: '', mode: 'online' as 'online' | 'in_person' | 'both', approximateArea: '' })
  const [rules, setRules] = useState([pilotRules[0]])
  const [draftRestored, setDraftRestored] = useState(false)
  const index = circleIndexPresentation(mine, discover)
  const loading = index.loading || eligibility === undefined
  const member = useMobileMember()
  const draftStorage = useMemo(() => getCircleDraftStorage(), [])
  const draftController = useMemo(() => new CircleDraftController(draftStorage), [draftStorage])
  const memberKey = member.status === 'ready' ? String(member.viewer._id) : null

  useLayoutEffect(() => {
    setForm({ name: '', slug: '', purpose: '', category: '', mode: 'online', approximateArea: '' })
    setRules([pilotRules[0]])
    setDraftRestored(false)
    setError('')
    void draftController.switchMember(memberKey, (saved) => {
      if (!saved) return
      setForm({ name: saved.name, slug: saved.slug, purpose: saved.purpose, category: saved.category, mode: saved.mode, approximateArea: saved.approximateArea })
      setRules(saved.rules.length ? saved.rules : [pilotRules[0]])
      setDraftRestored(true)
    })
    return () => { void draftController.switchMember(null, () => undefined) }
  }, [memberKey, draftController])

  function updateForm(next: typeof form) {
    setForm(next)
    setDraftRestored(false)
    void draftController.save({ ...emptyCircleCreationDraft(), ...next, rules, updatedAt: Date.now() })
  }

  function updateRules(next: string[]) {
    setRules(next)
    setDraftRestored(false)
    void draftController.save({ ...emptyCircleCreationDraft(), ...form, rules: next, updatedAt: Date.now() })
  }

  async function discardDraft() {
    const cleared = await draftController.clear()
    if (!cleared) {
      setError('The saved draft could not be discarded on this device. Try again before editing it.')
      return
    }
    setForm({ name: '', slug: '', purpose: '', category: '', mode: 'online', approximateArea: '' })
    setRules([pilotRules[0]])
    setDraftRestored(false)
    setError('')
  }

  async function submit() {
    if (!eligibility?.eligible || busy || !rules.length) return
    setBusy(true)
    setError('')
    try {
      const circleId = await create({
        name: form.name,
        slug: form.slug,
        purpose: form.purpose,
        category: form.category,
        mode: form.mode,
        approximateArea: form.approximateArea.trim() || undefined,
        rules,
      })
      const cleared = await draftController.clear()
      if (!cleared) Alert.alert('Circle created', 'The Circle was created, but its saved draft could not be removed from this device.')
      setDraftRestored(false)
      router.replace({ pathname: '/circles/[id]', params: { id: circleId } } as never)
    } catch (cause) {
      setError(circleActionError(cause, 'The Circle could not be created.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      <AppHeader title="Circles" subtitle="Shared interests and familiar groups" back />
      {loading ? <StateView embedded loading title="Loading circles" /> : null}
      {!loading && eligibility?.eligible ? <ActionButton label={showCreate ? 'Close Circle form' : 'Create Circle'} intent="self" secondary={!showCreate} onPress={() => { setError(''); setShowCreate((value) => !value) }} /> : null}
      {!loading && eligibility && !eligibility.eligible ? <InlineNotice title="Verification required" tone="neutral">Current identity verification is required before you can create and host a Circle.</InlineNotice> : null}

      {showCreate ? (
        <View style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]} accessibilityLabel="Create a Circle">
          <AppText variant="heading">Create a Circle</AppText>
          <AppText color={theme.colors.textMuted}>You become the host and manage membership, roles, and rules.</AppText>
          {error ? <InlineNotice title="Circle not created" tone="danger">{error}</InlineNotice> : null}
          {draftRestored ? <InlineNotice title="Draft restored" tone="neutral">Your unfinished Circle details were restored.</InlineNotice> : null}
          {draftRestored ? <ActionButton label="Discard draft" intent="self" secondary compact onPress={() => void discardDraft()} /> : null}
          <LabeledField label="Name"><TextField value={form.name} maxLength={80} placeholder="Cebu Coffee Friends" onChangeText={(name) => updateForm({ ...form, name })} /></LabeledField>
          <LabeledField label="URL slug"><TextField value={form.slug} maxLength={60} autoCapitalize="none" placeholder="cebu-coffee-friends" onChangeText={(slug) => updateForm({ ...form, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></LabeledField>
          <LabeledField label="Purpose"><TextField multiline value={form.purpose} maxLength={500} placeholder="What brings this Circle together?" onChangeText={(purpose) => updateForm({ ...form, purpose })} /></LabeledField>
          <LabeledField label="Category"><TextField value={form.category} maxLength={60} placeholder="Coffee" onChangeText={(category) => updateForm({ ...form, category })} /></LabeledField>
          <AppText variant="label">SESSION FORMAT</AppText>
          <View style={styles.row}>{(['online', 'in_person', 'both'] as const).map((mode) => <ActionButton key={mode} compact label={mode === 'in_person' ? 'In person' : mode === 'both' ? 'Both' : 'Online'} intent="self" secondary={form.mode !== mode} onPress={() => updateForm({ ...form, mode })} />)}</View>
          <LabeledField label="Approximate area"><TextField value={form.approximateArea} maxLength={80} placeholder="Cebu City or Online" onChangeText={(approximateArea) => updateForm({ ...form, approximateArea })} /></LabeledField>
          <AppText variant="label">CIRCLE RULES</AppText>
          {pilotRules.map((rule) => <Checkbox key={rule} label={rule} checked={rules.includes(rule)} onChange={(checked) => updateRules(checked ? [...rules, rule] : rules.filter((item) => item !== rule))} />)}
          <ActionButton label="Create Circle" intent="self" loading={busy} disabled={!form.name.trim() || !form.slug.trim() || !form.purpose.trim() || !form.category.trim() || !rules.length} onPress={() => void submit()} />
        </View>
      ) : null}

      {!loading ? <CircleSection title="My circles" empty="You have not joined a Circle yet." circles={index.mine} /> : null}
      {!loading ? <DiscoverSection circles={index.available} /> : null}
    </Screen>
  )
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><AppText variant="label">{label.toUpperCase()}</AppText>{children}</View>
}

function CircleSection({ title, empty, circles }: { title: string; empty: string; circles: Array<Parameters<typeof CircleCard>[0]['circle']> }) {
  const theme = useAppTheme()
  return <View style={styles.section}><View style={styles.sectionTitle}><AppText variant="heading">{title}</AppText><AppText color={theme.colors.textMuted}>{circles.length}</AppText></View>{circles.length ? <View style={styles.list}>{circles.map((circle) => <CircleCard key={circle._id} circle={{ ...circle, _id: String(circle._id) }} />)}</View> : <StateView embedded title={empty} detail="Browse active Circles and request a place in one that fits." />}</View>
}

function DiscoverSection({ circles }: { circles: Array<{ _id: string; name: string; purpose: string; category: string; memberCount: number; mode: 'online' | 'in_person' | 'both'; approximateArea?: string; joinPolicy?: 'approval_required' | 'open'; host?: { displayName: string } | null }> }) {
  const theme = useAppTheme()
  return <View style={styles.section}><View style={styles.sectionTitle}><AppText variant="heading">Discover circles</AppText><AppText color={theme.colors.textMuted}>{circles.length}</AppText></View><AppText color={theme.colors.textMuted}>Preview a Circle before joining. Open one to read its rules and request a place.</AppText>{circles.length ? <View style={styles.list}>{circles.map((circle) => <CirclePreviewCard key={String(circle._id)} circle={{ _id: String(circle._id), name: circle.name, purpose: circle.purpose, category: circle.category, memberCount: circle.memberCount, mode: circle.mode, approximateArea: circle.approximateArea, hostDisplayName: circle.host?.displayName ?? null, joinPolicy: circle.joinPolicy ?? null }} />)}</View> : <StateView embedded title="No new Circles right now." detail="Your joined Circles are listed above." />}</View>
}

const styles = StyleSheet.create({
  screen: { gap: 16 },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, gap: 12 },
  field: { gap: 5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: 10, marginTop: 8 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: 8 },
})
