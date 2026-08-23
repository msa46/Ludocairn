import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type {
  AssignmentDefinition,
  GameDefinition,
  PlayerFieldDefinition,
  RoleDefinition,
  RoleDistribution,
} from '../../games/model'
import { parseGameSource } from '../../games/parse'
import { serializeGameSource } from '../../games/source'
import { RoleEditor } from './RoleEditor'

const baseGame: GameDefinition = {
  schemaVersion: 1,
  id: 'role-editor-test',
  name: 'Role Editor Test',
  summary: 'Exercises guided role authoring.',
  deck: 'standard-52',
  players: { min: 5, max: 8 },
  roles: [],
  roleDistributions: [],
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# Role Editor Test\n',
  source: 'test/game.md',
}

interface RenderRoleEditorOptions {
  readonly roles?: readonly RoleDefinition[]
  readonly roleDistributions?: readonly RoleDistribution[]
  readonly assignments?: AssignmentDefinition
  readonly fields?: readonly PlayerFieldDefinition[]
  readonly deck?: GameDefinition['deck']
}

function renderRoleEditor({
  roles = [],
  roleDistributions = [],
  assignments,
  fields = [],
  deck = 'standard-52',
}: RenderRoleEditorOptions = {}) {
  let latestRoles = roles
  const emitted: (readonly RoleDefinition[])[] = []

  function Fixture() {
    const [currentRoles, setCurrentRoles] = useState(roles)
    return (
      <RoleEditor
        assignments={assignments}
        deck={deck}
        fields={fields}
        roleDistributions={roleDistributions}
        roles={currentRoles}
        onChange={(nextRoles) => {
          emitted.push(nextRoles)
          latestRoles = nextRoles
          setCurrentRoles(nextRoles)
        }}
      />
    )
  }

  render(<Fixture />)
  return { emitted, latestRoles: () => latestRoles }
}

function setRoleIdentity(
  index: number,
  values: { id: string; label: string; team: string; summary: string },
) {
  fireEvent.change(screen.getByLabelText(`Role ${index + 1} ID`), {
    target: { value: values.id },
  })
  fireEvent.change(screen.getByLabelText(`Role ${index + 1} label`), {
    target: { value: values.label },
  })
  fireEvent.change(screen.getByLabelText(`Role ${index + 1} team`), {
    target: { value: values.team },
  })
  fireEvent.change(screen.getByLabelText(`Role ${index + 1} summary`), {
    target: { value: values.summary },
  })
}

function setCardMarker(
  index: number,
  values: {
    label: string
    ids: string
    suits: string
    ranks: string
    arcana: string
    tags: string
  },
) {
  fireEvent.change(screen.getByLabelText(`Role ${index + 1} card label`), {
    target: { value: values.label },
  })
  for (const property of ['ids', 'suits', 'ranks', 'arcana', 'tags'] as const) {
    fireEvent.change(
      screen.getByLabelText(`Role ${index + 1} card ${property}`),
      { target: { value: values[property] } },
    )
  }
}

describe('RoleEditor', () => {
  it('authors repeatable roles with every applicable selector property', () => {
    const { emitted, latestRoles } = renderRoleEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
    setRoleIdentity(0, {
      id: 'oracle',
      label: 'Oracle',
      team: 'Light',
      summary: 'Reads the signal.',
    })
    fireEvent.click(screen.getByLabelText('Oracle uses a card marker'))
    setCardMarker(0, {
      label: 'Red court card',
      ids: ' standard-52:hearts:king ',
      suits: 'hearts, diamonds',
      ranks: 'king, queen',
      arcana: '',
      tags: 'red, face',
    })

    expect(latestRoles()[0]).toEqual({
      id: 'oracle',
      label: 'Oracle',
      team: 'Light',
      summary: 'Reads the signal.',
      card: {
        label: 'Red court card',
        selector: {
          ids: ['standard-52:hearts:king'],
          suits: ['hearts', 'diamonds'],
          ranks: ['king', 'queen'],
          tags: ['red', 'face'],
        },
      },
    })
    for (const roles of emitted) {
      expect(
        parseGameSource(
          serializeGameSource({ ...baseGame, roles }),
          'test/game.md',
        ),
      ).toMatchObject({ ok: true })
    }
  })

  it('keeps deck-invalid selector tokens local and accepts tarot arcana', () => {
    const standard = renderRoleEditor({
      roles: [
        {
          id: 'oracle',
          label: 'Oracle',
          summary: 'Reads the signal.',
          card: { label: 'Heart', selector: { suits: ['hearts'] } },
        },
      ],
    })

    fireEvent.change(screen.getByLabelText('Role 1 card suits'), {
      target: { value: 'stars' },
    })

    expect(standard.emitted).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown suits value')

    const tarot = renderRoleEditor({
      deck: 'tarot',
      roles: [
        {
          id: 'seer',
          label: 'Seer',
          summary: 'Reads the arcana.',
          card: { label: 'Major', selector: { arcana: ['minor'] } },
        },
      ],
    })
    fireEvent.change(screen.getAllByLabelText('Role 1 card arcana')[1], {
      target: { value: 'major' },
    })

    expect(tarot.latestRoles()[0]?.card?.selector).toEqual({
      arcana: ['major'],
    })
  })

  it('blocks role identity changes that would orphan dependent sections', () => {
    const roles: readonly RoleDefinition[] = [
      { id: 'oracle', label: 'Oracle', summary: 'Reads the signal.' },
      { id: 'villager', label: 'Villager', summary: 'Finds the truth.' },
    ]
    const roleDistributions: readonly RoleDistribution[] = [
      {
        players: { min: 5, max: 8 },
        counts: { oracle: 1, villager: 'remaining' },
      },
    ]
    const assignments: AssignmentDefinition = {
      method: 'shuffle',
      visibility: { players: 'own', gameMaster: 'all' },
    }
    const fields: readonly PlayerFieldDefinition[] = [
      { id: 'role', label: 'Role', type: 'role', default: 'oracle' },
    ]
    const { emitted } = renderRoleEditor({
      roles,
      roleDistributions,
      assignments,
      fields,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
    expect(emitted).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('Role distributions')
    expect(screen.getByRole('alert')).toHaveTextContent('Digital dealing')

    fireEvent.change(screen.getByLabelText('Role 1 ID'), {
      target: { value: 'seer' },
    })

    expect(emitted).toHaveLength(0)
    expect(screen.getByRole('alert')).toHaveTextContent('Role distributions')
    expect(screen.getByRole('alert')).toHaveTextContent('Tracker fields')
    expect(screen.getByRole('alert')).toHaveTextContent('Digital dealing')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Oracle' }))
    expect(emitted).toHaveLength(0)
  })

  it('moves and removes roles when no dependent section references them', () => {
    const { latestRoles } = renderRoleEditor({
      roles: [
        { id: 'oracle', label: 'Oracle', summary: 'Reads the signal.' },
        { id: 'villager', label: 'Villager', summary: 'Finds the truth.' },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Move Villager up' }))
    expect(latestRoles().map((role) => role.id)).toEqual(['villager', 'oracle'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Villager' }))
    expect(latestRoles().map((role) => role.id)).toEqual(['oracle'])
  })

  it('synchronizes complete drafts when controlled role props change', () => {
    const oracle: RoleDefinition = {
      id: 'oracle',
      label: 'Oracle',
      summary: 'Reads the signal.',
    }
    const villager: RoleDefinition = {
      id: 'villager',
      label: 'Villager',
      summary: 'Finds the truth.',
    }
    const onChange = vi.fn()
    const { rerender } = render(
      <RoleEditor
        deck="standard-52"
        fields={[]}
        roleDistributions={[]}
        roles={[oracle]}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Role 1 summary'), {
      target: { value: '' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Role summaries must be non-empty',
    )

    rerender(
      <RoleEditor
        deck="standard-52"
        fields={[]}
        roleDistributions={[]}
        roles={[villager]}
        onChange={onChange}
      />,
    )

    expect(screen.getByLabelText('Role 1 ID')).toHaveValue('villager')
    expect(screen.getByLabelText('Role 1 summary')).toHaveValue(
      'Finds the truth.',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    rerender(
      <RoleEditor
        deck="standard-52"
        fields={[]}
        roleDistributions={[]}
        roles={[{ ...oracle }]}
        onChange={onChange}
      />,
    )
    expect(screen.getByLabelText('Role 1 summary')).toHaveValue(
      'Reads the signal.',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('preserves an incomplete draft across semantically equivalent role props', () => {
    const oracle: RoleDefinition = {
      id: 'oracle',
      label: 'Oracle',
      summary: 'Reads the signal.',
    }
    const onChange = vi.fn()
    const { rerender } = render(
      <RoleEditor
        deck="standard-52"
        fields={[]}
        roleDistributions={[]}
        roles={[oracle]}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByLabelText('Role 1 summary'), {
      target: { value: '' },
    })

    rerender(
      <RoleEditor
        deck="standard-52"
        fields={[]}
        roleDistributions={[]}
        roles={[{ ...oracle }]}
        onChange={onChange}
      />,
    )

    expect(screen.getByLabelText('Role 1 summary')).toHaveValue('')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Role summaries must be non-empty',
    )
  })
})
