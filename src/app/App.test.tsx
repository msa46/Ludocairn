import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App', () => {
  it('identifies Deckwright as the application heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Deckwright' }),
    ).toBeInTheDocument()
  })
})
