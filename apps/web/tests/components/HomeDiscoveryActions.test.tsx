// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const clerk = vi.hoisted(() => ({ openSignIn: vi.fn() }))
const links = vi.hoisted(() => [] as string[])

vi.mock('../../convex/_generated/api', () => ({
  api: { companions: { listApproved: 'companions.listApproved' } },
}))

vi.mock('convex/react', () => ({ useQuery: () => [] }))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  useClerk: () => clerk,
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => {
    links.push(to)
    return <a href={to} {...props}>{children}</a>
  },
  Navigate: () => null,
}))

import { HomePage } from '../../src/routes/index'

afterEach(() => {
  cleanup()
  clerk.openSignIn.mockReset()
  links.length = 0
})

describe('signed-out Home discovery actions', () => {
  it('opens sign-in instead of linking to the gated discovery feed', () => {
    render(<HomePage />)

    expect(links).not.toContain('/nearby')

    fireEvent.click(screen.getByRole('button', { name: 'Explore Companions' }))
    expect(clerk.openSignIn).toHaveBeenCalledTimes(1)
  })
})
