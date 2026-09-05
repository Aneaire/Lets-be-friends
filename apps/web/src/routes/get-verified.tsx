import { createFileRoute } from '@tanstack/react-router'
import { GetVerifiedPage } from '../features/verification/GetVerifiedPage'

export const Route = createFileRoute('/get-verified')({ component: GetVerifiedPage })
