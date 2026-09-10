import { useMutation, useQuery } from 'convex/react'
import { router } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

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
import { circleIndexPresentation } from './circlePresentation'

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
  const index = circleIndexPresentation(mine, discover)
  const loading = index.loading || eligibility === undefined

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
      router.replace({ pathname: '/circles/[id]', params: { id: circleId } } as never)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Circle could not be created.')
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
          <LabeledField label="Name"><TextField value={form.name} maxLength={80} placeholder="Cebu Coffee Friends" onChangeText={(name) => setForm((current) => ({ ...current, name }))} /></LabeledField>
          <LabeledField label="URL slug"><TextField value={form.slug} maxLength={60} autoCapitalize="none" placeholder="cebu-coffee-friends" onChangeText={(slug) => setForm((current) => ({ ...current, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} /></LabeledField>
          <LabeledField label="Purpose"><TextField multiline value={form.purpose} maxLength={500} placeholder="What brings this Circle together?" onChangeText={(purpose) => setForm((current) => ({ ...current, purpose }))} /></LabeledField>
          <LabeledField label="Category"><TextField value={form.category} maxLength={60} placeholder="Coffee" onChangeText={(category) => setForm((current) => ({ ...current, category }))} /></LabeledField>
          <AppText variant="label">SESSION FORMAT</AppText>
          <View style={styles.row}>{(['online', 'in_person', 'both'] as const).map((mode) => <ActionButton key={mode} compact label={mode === 'in_person' ? 'In person' : mode === 'both' ? 'Both' : 'Online'} intent="self" secondary={form.mode !== mode} onPress={() => setForm((current) => ({ ...current, mode }))} />)}</View>
          <LabeledField label="Approximate area"><TextField value={form.approximateArea} maxLength={80} placeholder="Cebu City or Online" onChangeText={(approximateArea) => setForm((current) => ({ ...current, approximateArea }))} /></LabeledField>
          <AppText variant="label">CIRCLE RULES</AppText>
          {pilotRules.map((rule) => <Checkbox key={rule} label={rule} checked={rules.includes(rule)} onChange={(checked) => setRules((current) => checked ? [...current, rule] : current.filter((item) => item !== rule))} />)}
          <ActionButton label="Create Circle" intent="self" loading={busy} disabled={!form.name.trim() || !form.slug.trim() || !form.purpose.trim() || !form.category.trim() || !rules.length} onPress={() => void submit()} />
        </View>
      ) : null}

      {!loading ? <CircleSection title="My circles" empty="You have not joined a Circle yet." circles={index.mine} /> : null}
      {!loading ? <CircleSection title="Discover circles" empty="No new Circles right now." circles={index.available} /> : null}
    </Screen>
  )
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><AppText variant="label">{label.toUpperCase()}</AppText>{children}</View>
}

function CircleSection({ title, empty, circles }: { title: string; empty: string; circles: Array<Parameters<typeof CircleCard>[0]['circle']> }) {
  const theme = useAppTheme()
  return <View style={styles.section}><View style={styles.sectionTitle}><AppText variant="heading">{title}</AppText><AppText color={theme.colors.textMuted}>{circles.length}</AppText></View>{circles.length ? <View style={styles.list}>{circles.map((circle) => <CircleCard key={circle._id} circle={{ ...circle, _id: String(circle._id) }} />)}</View> : <StateView embedded title={empty} detail={title === 'My circles' ? 'Browse active Circles and request a place in one that fits.' : 'Your joined Circles are listed above.'} />}</View>
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
