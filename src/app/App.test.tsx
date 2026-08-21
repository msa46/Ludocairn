import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('renders a semantic foundation shell', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tabletop games, clearly tracked.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'The foundation is ready for the card and game engines.',
      ),
    ).toBeInTheDocument()
  })
})
