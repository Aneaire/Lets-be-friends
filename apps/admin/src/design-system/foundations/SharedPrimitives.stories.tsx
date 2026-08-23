import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShieldCheck } from 'lucide-react'
import { Button } from '../../../../web/src/design-system/atoms/Button'
import { StatusBadge } from '../../../../web/src/design-system/atoms/StatusBadge'
import { InlineNotice } from '../../../../web/src/design-system/molecules/FeedbackState'
import { Surface } from '../../../../web/src/design-system/molecules/Surface'

function SharedPrimitives() { return <div className="ds-story-stack"><Surface density="compact"><div className="ds-story-row"><StatusBadge tone="warning">Review needed</StatusBadge><StatusBadge tone="success">Resolved</StatusBadge></div></Surface><InlineNotice title="Admin actions stay neutral">Approval and resolution use neutral controls. Safety actions use danger.</InlineNotice><div className="ds-story-row"><Button intent="neutral" leadingIcon={<ShieldCheck size={16} />}>Review record</Button><Button intent="danger">Suspend member</Button></div></div> }
const meta = { title: 'Admin/Foundations/Shared primitives', component: SharedPrimitives, parameters: { viewport: { defaultViewport: 'mobileDefault' } } } satisfies Meta<typeof SharedPrimitives>
export default meta
type Story = StoryObj<typeof meta>
export const SemanticAdminStates: Story = {}
