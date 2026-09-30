// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true }))

vi.mock('@clerk/react', () => ({ useAuth: () => authState }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => <div>Circle workspace route</div>,
  Navigate: ({ to }: { to: string }) => <div>Redirected to {to}</div>,
}))

vi.mock('../../src/features/circles/CircleIndexPage', () => ({
  CircleIndexPage: () => <div>Circle index page</div>,
}))

import { CircleLayout } from '../../src/routes/circles'
import { CircleIndexRoute } from '../../src/routes/circles.index'

afterEach(() => {
  cleanup()
  authState.isLoaded = true
  authState.isSignedIn = true
})

describe('Circle routes', () => {
  it('renders child route content through the Circle layout when signed in', () => {
    render(<CircleLayout />)

    expect(screen.getByText('Circle workspace route')).toBeTruthy()
  })

  it('keeps signed-out visitors out of Circle routes', () => {
    authState.isSignedIn = false

    render(<CircleLayout />)

    expect(screen.queryByText('Circle workspace route')).toBeNull()
    expect(screen.getByText('Redirected to /')).toBeTruthy()
  })

  it('keeps the Circle list on the index route', () => {
    render(<CircleIndexRoute />)

    expect(screen.getByText('Circle index page')).toBeTruthy()
  })
})
