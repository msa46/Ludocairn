import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type {
  AssignmentDefinition,
  PlayersDefinition,
  RoleDefinition,
  RoleDistribution,
} from '../../games/model'
import { DistributionEditor } from './DistributionEditor'

const roles: readonly RoleDefinition[] = [
  { id: 'oracle', label: 'Oracle', summary: 'Reads the signal.' },
  { id: 'villager', label: 'Villager', summary: 'Finds the truth.' },
]

interface DistributionValue {
  readonly roleDistributions: readonly RoleDistribution[]
  readonly assignments?: AssignmentDefinition
}

function renderDistributionEditor(
  initialRoles: readonly RoleDefinition[] = roles,
  players: PlayersDefinition = { min: 5, max: 8 },
  initial: DistributionValue = { roleDistributions: [] },
) {
  let latest = initial
  const emitted: DistributionValue[] = []

  function Fixture() {
    const [value, setValue] = useState(initial)
    return (
      <DistributionEditor
        assignments={value.assignments}
        players={players}
        roleDistributions={value.roleDistributions}
        roles={initialRoles}
        onChange={(next) => {
          latest = next
          emitted.push(next)
          setValue(next)
        }}
      />
    )
  }

  render(<Fixture />)
  return { emitted, latest: () => latest }
}

function setBand(
  index: number,
  values: { min: string; max: string; oracle: string; villager: string },
) {
  fireEvent.change(
    screen.getByLabelText(`Distribution band ${index + 1} minimum players`),
    { target: { value: values.min } },
  )
  fireEvent.change(
    screen.getByLabelText(`Distribution band ${index + 1} maximum players`),
    { target: { value: values.max } },
  )
  fireEvent.change(
    screen.getByLabelText(`Distribution band ${index + 1} Oracle count`),
    { target: { value: values.oracle } },
  )
  fireEvent.change(
    screen.getByLabelText(`Distribution band ${index + 1} Villager count`),
    { target: { value: values.villager } },
  )
}

describe('DistributionEditor', () => {
  it('requires every role count, supports remaining, and enables visibility', () => {
    const { latest } = renderDistributionEditor()

    expect(screen.getByLabelText('Enable digital dealing')).toBeDisabled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Add distribution band' }),
    )
    setBand(0, {
      min: '5',
      max: '8',
      oracle: '1',
      villager: 'remaining',
    })
    fireEvent.click(screen.getByLabelText('Enable digital dealing'))
    fireEvent.change(screen.getByLabelText('Player assignment visibility'), {
      target: { value: 'own' },
    })
    fireEvent.change(
      screen.getByLabelText('Game Master assignment visibility'),
      { target: { value: 'all' } },
    )

    expect(latest()).toEqual({
      roleDistributions: [
        {
          players: { min: 5, max: 8 },
          counts: { oracle: 1, villager: 'remaining' },
        },
      ],
      assignments: {
        method: 'shuffle',
        visibility: { players: 'own', gameMaster: 'all' },
      },
    })
  })

  it('keeps incomplete and invalid bands local until all player counts are covered', () => {
    const { emitted, latest } = renderDistributionEditor()

    fireEvent.click(
      screen.getByRole('button', { name: 'Add distribution band' }),
    )
    setBand(0, {
      min: '5',
      max: '6',
      oracle: '1',
      villager: 'remaining',
    })
    expect(emitted).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('cover every')

    fireEvent.click(
      screen.getByRole('button', { name: 'Add distribution band' }),
    )
    setBand(1, {
      min: '7',
      max: '8',
      oracle: '1',
      villager: 'remaining',
    })

    expect(latest().roleDistributions).toEqual([
      {
        players: { min: 5, max: 6 },
        counts: { oracle: 1, villager: 'remaining' },
      },
      {
        players: { min: 7, max: 8 },
        counts: { oracle: 1, villager: 'remaining' },
      },
    ])

    fireEvent.change(
      screen.getByLabelText('Distribution band 2 Oracle count'),
      { target: { value: 'remaining' } },
    )
    expect(screen.getByRole('alert')).toHaveTextContent('At most one')
    expect(latest().roleDistributions[1]?.counts).toEqual({
      oracle: 1,
      villager: 'remaining',
    })
  })

  it('disables distribution and assignment authoring without schema prerequisites', () => {
    renderDistributionEditor([], { min: 2 })

    expect(
      screen.getByRole('button', { name: 'Add distribution band' }),
    ).toBeDisabled()
    expect(screen.getByLabelText('Enable digital dealing')).toBeDisabled()
    expect(screen.getByText(/roles and a maximum player count/i)).toBeVisible()
  })

  it('requires digital dealing to be disabled before the last distribution is removed', () => {
    const distribution: RoleDistribution = {
      players: { min: 5, max: 8 },
      counts: { oracle: 1, villager: 'remaining' },
    }
    const assignments: AssignmentDefinition = {
      method: 'shuffle',
      visibility: { players: 'own', gameMaster: 'all' },
    }
    const { emitted } = renderDistributionEditor(
      roles,
      { min: 5, max: 8 },
      {
        roleDistributions: [distribution],
        assignments,
      },
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove distribution band 1' }),
    )

    expect(emitted).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Disable digital dealing first',
    )
  })

  it('disables assignment visibility while a distribution draft is incomplete', () => {
    const distribution: RoleDistribution = {
      players: { min: 5, max: 8 },
      counts: { oracle: 1, villager: 'remaining' },
    }
    const assignments: AssignmentDefinition = {
      method: 'shuffle',
      visibility: { players: 'own', gameMaster: 'all' },
    }
    renderDistributionEditor(
      roles,
      { min: 5, max: 8 },
      {
        roleDistributions: [distribution],
        assignments,
      },
    )

    fireEvent.change(
      screen.getByLabelText('Distribution band 1 maximum players'),
      { target: { value: '7' } },
    )

    expect(screen.getByLabelText('Enable digital dealing')).toBeEnabled()
    expect(screen.getByLabelText('Player assignment visibility')).toBeDisabled()
    expect(
      screen.getByLabelText('Game Master assignment visibility'),
    ).toBeDisabled()
  })

  it('synchronizes complete drafts when controlled distributions change', () => {
    const onChange = vi.fn()
    const wide: RoleDistribution = {
      players: { min: 5, max: 8 },
      counts: { oracle: 1, villager: 'remaining' },
    }
    const exact: RoleDistribution = {
      players: { min: 5, max: 5 },
      counts: { oracle: 1, villager: 'remaining' },
    }
    const { rerender } = render(
      <DistributionEditor
        players={{ min: 5, max: 8 }}
        roleDistributions={[wide]}
        roles={roles}
        onChange={onChange}
      />,
    )

    fireEvent.change(
      screen.getByLabelText('Distribution band 1 Oracle count'),
      { target: { value: '' } },
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'needs a non-negative count',
    )

    rerender(
      <DistributionEditor
        players={{ min: 5, max: 5 }}
        roleDistributions={[exact]}
        roles={roles}
        onChange={onChange}
      />,
    )

    expect(
      screen.getByLabelText('Distribution band 1 maximum players'),
    ).toHaveValue('5')
    expect(
      screen.getByLabelText('Distribution band 1 Oracle count'),
    ).toHaveValue('1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    rerender(
      <DistributionEditor
        players={{ min: 5, max: 8 }}
        roleDistributions={[
          {
            players: { ...wide.players },
            counts: { ...wide.counts },
          },
        ]}
        roles={roles}
        onChange={onChange}
      />,
    )
    expect(
      screen.getByLabelText('Distribution band 1 Oracle count'),
    ).toHaveValue('1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('preserves incomplete counts across semantically equivalent distribution props', () => {
    const distribution: RoleDistribution = {
      players: { min: 5, max: 8 },
      counts: { oracle: 1, villager: 'remaining' },
    }
    const onChange = vi.fn()
    const { rerender } = render(
      <DistributionEditor
        players={{ min: 5, max: 8 }}
        roleDistributions={[distribution]}
        roles={roles}
        onChange={onChange}
      />,
    )
    fireEvent.change(
      screen.getByLabelText('Distribution band 1 Oracle count'),
      { target: { value: '' } },
    )

    rerender(
      <DistributionEditor
        players={{ min: 5, max: 8 }}
        roleDistributions={[
          {
            players: { ...distribution.players },
            counts: { ...distribution.counts },
          },
        ]}
        roles={[...roles]}
        onChange={onChange}
      />,
    )

    expect(
      screen.getByLabelText('Distribution band 1 Oracle count'),
    ).toHaveValue('')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'needs a non-negative count',
    )
  })
})
