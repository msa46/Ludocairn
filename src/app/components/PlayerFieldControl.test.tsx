import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { PlayerFieldDefinition, RoleDefinition } from '../../games/model'
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

function NumberHarness({
  field = scoreField,
  initial = 0,
}: {
  readonly field?: PlayerFieldDefinition
  readonly initial?: number
}) {
  const [value, setValue] = useState(initial)
  return (
    <PlayerFieldControl
      field={field}
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

  it('disables increment when the next aligned step would cross an unaligned maximum', () => {
    render(<NumberHarness field={{ ...scoreField, max: 5 }} initial={4} />)

    const input = screen.getByLabelText('Ari — Score')
    const increase = screen.getByRole('button', {
      name: 'Increase Ari — Score',
    })

    expect(increase).toBeDisabled()
    fireEvent.click(increase)
    expect(input).toHaveValue(4)
  })

  it('disables decrement when the previous aligned step would cross a custom minimum', () => {
    const minimumAnchoredField: PlayerFieldDefinition = {
      ...scoreField,
      default: 1,
      min: 1,
      max: 5,
    }
    render(<NumberHarness field={minimumAnchoredField} initial={1} />)

    const input = screen.getByLabelText('Ari — Score')
    const decrease = screen.getByRole('button', {
      name: 'Decrease Ari — Score',
    })

    expect(decrease).toBeDisabled()
    fireEvent.click(decrease)
    expect(input).toHaveValue(1)
  })

  it('normalizes bounded decimal increment and decrement without floating artifacts', () => {
    const decimalField: PlayerFieldDefinition = {
      ...scoreField,
      default: 0,
      min: 0,
      max: 0.3,
      step: 0.1,
    }
    render(<NumberHarness field={decimalField} initial={0.2} />)

    const input = screen.getByLabelText('Ari — Score')
    const decrease = screen.getByRole('button', {
      name: 'Decrease Ari — Score',
    })
    const increase = screen.getByRole('button', {
      name: 'Increase Ari — Score',
    })

    expect(increase).toBeEnabled()
    fireEvent.click(increase)
    expect(input).toHaveValue(0.3)
    expect(increase).toBeDisabled()

    fireEvent.click(decrease)
    expect(input).toHaveValue(0.2)
  })
})

describe('PlayerFieldControl role controls', () => {
  it('labels a native select with role labels while emitting the stable role ID', () => {
    const roles: readonly RoleDefinition[] = [
      {
        id: 'echo',
        label: 'Echo',
        summary: 'Privately tests one active player.',
      },
      {
        id: 'wayfinder',
        label: 'Wayfinder',
        summary: 'Finds Drifters through public discussion.',
      },
    ]
    const onChange = vi.fn()

    render(
      <PlayerFieldControl
        field={{
          id: 'role',
          label: 'Role',
          type: 'role',
          default: 'wayfinder',
        }}
        playerName="Ari"
        roles={roles}
        value="wayfinder"
        onChange={onChange}
      />,
    )

    const select = screen.getByRole('combobox', { name: 'Ari — Role' })
    expect(select).toHaveDisplayValue('Wayfinder')
    fireEvent.change(select, { target: { value: 'echo' } })
    expect(onChange).toHaveBeenCalledWith('echo')
  })
})
