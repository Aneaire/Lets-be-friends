// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => <div>Circle workspace route</div>,
}))

vi.mock('../../src/features/circles/CircleIndexPage', () => ({
  CircleIndexPage: () => <div>Circle index page</div>,
}))

import { CircleLayout } from '../../src/routes/circles'
import { CircleIndexRoute } from '../../src/routes/circles.index'

afterEach(cleanup)

describe('Circle routes', () => {
  it('renders child route content through the Circle layout', () => {
    render(<CircleLayout />)

    expect(screen.getByText('Circle workspace route')).toBeTruthy()
  })

  it('keeps the Circle list on the index route', () => {
    render(<CircleIndexRoute />)

    expect(screen.getByText('Circle index page')).toBeTruthy()
  })
})
