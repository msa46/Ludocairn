import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { PlayerFieldDefinition } from '../../games/model'
import { PlayerFieldControl } from './PlayerFieldControl'

const scoreField: PlayerFieldDefinition = {
  id: 'score',
  label: 'Score',
  type: 'number',
  default: 0,
  min: 0,
  max: 4,
  step: 2,
}

function NumberHarness() {
  const [value, setValue] = useState(0)
  return (
    <PlayerFieldControl
      field={scoreField}
      playerName="Ari"
      value={value}
      onChange={(next) => setValue(Number(next))}
    />
  )
}

describe('PlayerFieldControl number controls', () => {
  it('provides named step buttons and disables them at numeric boundaries', () => {
    render(<NumberHarness />)

    const input = screen.getByLabelText('Ari — Score')
    const decrease = screen.getByRole('button', {
      name: 'Decrease Ari — Score',
    })
    const increase = screen.getByRole('button', {
      name: 'Increase Ari — Score',
    })

    expect(input).toHaveValue(0)
    expect(decrease).toBeDisabled()
    expect(increase).toBeEnabled()

    fireEvent.click(increase)
    expect(input).toHaveValue(2)
    expect(decrease).toBeEnabled()

    fireEvent.click(increase)
    expect(input).toHaveValue(4)
    expect(increase).toBeDisabled()

    fireEvent.click(decrease)
    expect(input).toHaveValue(2)
  })
})
