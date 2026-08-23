import type { Meta, StoryObj } from '@storybook/react-vite'
import { CompanionListItem, type DiscoveryCompanion } from './CompanionListItem'

const companion: DiscoveryCompanion = {
  _id: 'companion-1',
  userId: 'user-1',
  kind: 'companion',
  displayName: 'Angelo Santiago',
  city: 'Angeles City',
  mode: 'both',
  rating: 4.9,
  reviewCount: 18,
  distanceKm: 3.2,
  intro: 'Coffee walks, errands, and an easy conversation when you need company.',
  strengths: ['Good listener', 'Patient'],
  verified: true,
  following: false,
}

const meta = {
  title: 'Web/Organisms/Companion list item',
  component: CompanionListItem,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  decorators: [(Story) => <div className="discover-results"><div className="panel discover-results-panel"><div className="worklist" role="list"><Story /></div></div></div>],
  args: { companion, signedIn: true, onFollow: async () => undefined },
} satisfies Meta<typeof CompanionListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Following: Story = { args: { companion: { ...companion, following: true } } }
export const Member: Story = { args: { companion: { ...companion, _id: 'member-1', kind: 'member', city: 'Member', rating: 0, reviewCount: 0, distanceKm: undefined, intro: "A member of the Let's Be Friends community.", strengths: [] } } }
export const LongContent: Story = { args: { companion: { ...companion, displayName: 'Niko Santiago-Zoobook with a very long display name', intro: 'I enjoy unhurried museum visits, neighborhood food trips, and helping people feel comfortable in a new place without overplanning every minute.' } } }
