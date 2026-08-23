import type { Meta, StoryObj } from '@storybook/react-vite'

export function DensityReference() {
  return (
    <main className="panel" style={{ width: 'min(100%, 38rem)', padding: 'var(--density-card-padding)' }}>
      <p className="text-label">Foundations</p>
      <h1 className="text-h1">Compact mobile-first density</h1>
      <p className="text-body">A four-pixel spacing base keeps information dense. Touch controls remain at least 44 pixels tall on small screens.</p>
      <div className="field-row" style={{ marginTop: 'var(--density-space-4)' }}>
        <label className="label" htmlFor="density-example">Example field</label>
        <input className="field" id="density-example" placeholder="Compact input" />
      </div>
      <div className="density-action-grid" aria-label="Action density examples">
        <button className="btn btn-self" type="button">Self action</button>
        <button className="btn btn-social" type="button">Social action</button>
        <button className="btn btn-neutral" type="button">Neutral action</button>
      </div>
    </main>
  )
}

const meta = {
  title: 'Foundations/Density',
  component: DensityReference,
  globals: { viewport: 'mobileDefault' },
} satisfies Meta<typeof DensityReference>

export default meta
type Story = StoryObj<typeof meta>

export const CompactMobile: Story = {}
