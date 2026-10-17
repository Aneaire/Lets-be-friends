import { createFileRoute } from '@tanstack/react-router'
import { VerifiedPage } from '../features/verification/VerifiedPage'

export const Route = createFileRoute('/verified')({ component: VerifiedPage })
