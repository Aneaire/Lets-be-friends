import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { defaultDiscoveryFilters, type DiscoveryFilters } from '@/data/discovery'

import { DiscoveryFilterSheetPresentation } from './DiscoveryFilterSheet'

function FilterSheetStory({ initialFilters = defaultDiscoveryFilters }: { initialFilters?: DiscoveryFilters }) {
  const [visible, setVisible] = useState(true)
  const [filters, setFilters] = useState(initialFilters)

  return (
    <View style={styles.story}>
      <ActionButton label="Open filters" onPress={() => setVisible(true)} />
      {visible ? (
        <View style={StyleSheet.absoluteFill}>
          <DiscoveryFilterSheetPresentation
            filters={filters}
            onChange={setFilters}
            onClose={() => setVisible(false)}
          />
        </View>
      ) : null}
    </View>
  )
}

const meta = {
  title: 'Mobile/Features/Discovery/Filter sheet',
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <FilterSheetStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Discovery filters' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Any format' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'Good company' })).toHaveAttribute('aria-pressed', 'false')
  },
}

export const SelectAndClose: Story = {
  render: () => <FilterSheetStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Online' }))
    await expect(canvas.getByRole('button', { name: 'Online' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'Any format' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(canvas.getByRole('button', { name: 'Show results' }))
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const ToggleCategoryAndStrength: Story = {
  render: () => <FilterSheetStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Good company' }))
    await expect(canvas.getByRole('button', { name: 'Good company' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(canvas.getByRole('button', { name: 'Good listener' }))
    await expect(canvas.getByRole('button', { name: 'Good listener' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(canvas.getByRole('button', { name: 'Good company' }))
    await expect(canvas.getByRole('button', { name: 'Good company' })).toHaveAttribute('aria-pressed', 'false')
  },
}

export const ResetFilters: Story = {
  render: () => <FilterSheetStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'In person' }))
    await expect(canvas.getByRole('button', { name: 'In person' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(canvas.getByRole('button', { name: 'Reset filters' }))
    await expect(canvas.getByRole('button', { name: 'Any format' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'In person' })).toHaveAttribute('aria-pressed', 'false')
    await expect(canvas.getByRole('dialog', { name: 'Discovery filters' })).toBeInTheDocument()
  },
}

export const CloseButton: Story = {
  render: () => <FilterSheetStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Close filters' }))
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const Narrow320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  render: () => <FilterSheetStory />,
}

const styles = StyleSheet.create({
  story: { flex: 1 },
})
