import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { PlayerFieldDefinition, RoleDefinition } from '../../games/model'
import { FieldEditor } from './FieldEditor'

const oracleRole: readonly RoleDefinition[] = [
  { id: 'oracle', label: 'Oracle', summary: 'Reads the signal.' },
]

function renderFieldEditor(
  fields: readonly PlayerFieldDefinition[] = [],
  roles: readonly RoleDefinition[] = oracleRole,
) {
  let latest = fields
  function Fixture() {
    const [currentFields, setCurrentFields] = useState(fields)
    return (
      <FieldEditor
        fields={currentFields}
        roles={roles}
        onChange={(nextFields) => {
          latest = nextFields
          setCurrentFields(nextFields)
        }}
      />
    )
  }
  render(<Fixture />)
  return () => latest
}

function addField(type: PlayerFieldDefinition['type']) {
  fireEvent.click(screen.getByRole('button', { name: 'Add tracker field' }))
  fireEvent.change(screen.getByLabelText('Field 1 ID'), {
    target: { value: `${type}-field` },
  })
  fireEvent.change(screen.getByLabelText('Field 1 type'), {
    target: { value: type },
  })
}

describe('FieldEditor', () => {
  it.each([
    ['boolean', { default: true }],
    ['choice', { choices: ['steady', 'daring'], default: 'steady' }],
    ['number', { default: 2, min: 0, max: 10, step: 2 }],
    ['text', { default: 'note', multiline: true }],
    ['role', { default: 'oracle' }],
  ] as const)('authors a valid %s tracker field', (type, expected) => {
    const latestFields = renderFieldEditor()
    addField(type)

    if (type === 'boolean') {
      fireEvent.click(screen.getByLabelText('Field 1 boolean default'))
    }
    if (type === 'choice') {
      fireEvent.change(screen.getByLabelText('Field 1 choices'), {
        target: { value: 'steady, daring' },
      })
      fireEvent.change(screen.getByLabelText('Field 1 default'), {
        target: { value: 'steady' },
      })
    }
    if (type === 'number') {
      fireEvent.change(screen.getByLabelText('Field 1 number default'), {
        target: { value: '2' },
      })
      fireEvent.change(screen.getByLabelText('Field 1 minimum'), {
        target: { value: '0' },
      })
      fireEvent.change(screen.getByLabelText('Field 1 maximum'), {
        target: { value: '10' },
      })
      fireEvent.change(screen.getByLabelText('Field 1 step'), {
        target: { value: '2' },
      })
    }
    if (type === 'text') {
      fireEvent.change(screen.getByLabelText('Field 1 text default'), {
        target: { value: 'note' },
      })
      fireEvent.click(screen.getByLabelText('Field 1 multiline'))
    }

    expect(latestFields()[0]).toMatchObject({
      id: `${type}-field`,
      type,
      ...expected,
    })
  })

  it('keeps invalid drafts local and reports every invalid tracker constraint', () => {
    const latestFields = renderFieldEditor(
      [
        { id: 'first', label: 'First', type: 'boolean', default: false },
        {
          id: 'choice',
          label: 'Choice',
          type: 'choice',
          choices: ['yes'],
          default: 'yes',
        },
        { id: 'number', label: 'Number', type: 'number', default: 0 },
        { id: 'role', label: 'Role', type: 'role', default: 'oracle' },
      ],
      [],
    )
    const before = latestFields()

    fireEvent.change(screen.getByLabelText('Field 2 ID'), {
      target: { value: 'first' },
    })
    fireEvent.change(screen.getByLabelText('Field 2 default'), {
      target: { value: 'no' },
    })
    fireEvent.change(screen.getByLabelText('Field 3 minimum'), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText('Field 3 maximum'), {
      target: { value: '0' },
    })

    expect(screen.getByText('Field IDs must be unique.')).toBeInTheDocument()
    expect(
      screen.getByText('Default must be one of the choices.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Minimum cannot exceed maximum.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Add a role before using a role field.'),
    ).toBeInTheDocument()
    expect(latestFields()).toBe(before)
  })

  it('preserves ID-input focus after a valid controlled field update', () => {
    const latestFields = renderFieldEditor()
    addField('boolean')
    const id = screen.getByLabelText('Field 1 ID')

    id.focus()
    fireEvent.change(id, { target: { value: 'ready' } })

    expect(document.activeElement).toBe(id)
    expect(latestFields()[0]).toMatchObject({ id: 'ready' })
  })

  it('does not emit a role field until a declared role can be selected', () => {
    const latestFields = renderFieldEditor([], [])
    addField('role')

    expect(
      screen.getByText('Add a role before using a role field.'),
    ).toBeInTheDocument()
    expect(latestFields()).toEqual([
      { id: 'role-field', label: 'Field 1', type: 'boolean', default: false },
    ])
  })

  it('moves and removes tracker fields with named controls', () => {
    const latestFields = renderFieldEditor([
      { id: 'ready', label: 'Ready', type: 'boolean', default: false },
      {
        id: 'note',
        label: 'Note',
        type: 'text',
        default: '',
        multiline: false,
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Move Note up' }))
    expect(latestFields().map((field) => field.id)).toEqual(['note', 'ready'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Note' }))
    expect(latestFields().map((field) => field.id)).toEqual(['ready'])
  })
})
