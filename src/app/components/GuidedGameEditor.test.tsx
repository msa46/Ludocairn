import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { GameDefinition } from '../../games/model'
import * as gameParser from '../../games/parse'
import { parseGameSource } from '../../games/parse'
import { MAX_GAME_SOURCE_BYTES } from '../../games/source'
import { GuidedGameEditor } from './GuidedGameEditor'

const minimalGame: GameDefinition = {
  schemaVersion: 1,
  id: 'river-council',
  name: 'River Council',
  summary: 'A council beside the river.',
  deck: 'standard-52',
  players: { min: 2, max: 6 },
  roles: [],
  roleDistributions: [],
  phases: [],
  round: { enabled: false },
  fields: [],
  rulesMarkdown: '# River Council\n\nOriginal rules.\n',
  source: 'fixture.md',
}

function renderGuided(game = minimalGame, idLocked = false) {
  let source = ''
  function Fixture() {
    const [currentGame, setCurrentGame] = useState(game)
    return (
      <GuidedGameEditor
        game={currentGame}
        idLocked={idLocked}
        onChange={(nextSource) => {
          source = nextSource
          const parsed = parseGameSource(
            nextSource,
            'custom/river-council/game.md',
          )
          if (parsed.ok) setCurrentGame(parsed.game)
        }}
      />
    )
  }
  render(<Fixture />)
  return () => source
}

function parseLatest(latestSource: () => string) {
  return parseGameSource(latestSource(), 'custom/river-council/game.md')
}

function setPhase(index: number, id: string, label: string) {
  fireEvent.change(screen.getByLabelText(`Phase ${index + 1} ID`), {
    target: { value: id },
  })
  fireEvent.change(screen.getByLabelText(`Phase ${index + 1} label`), {
    target: { value: label },
  })
}

describe('GuidedGameEditor', () => {
  it('edits identity and rules and emits valid canonical source', () => {
    const latestSource = renderGuided()

    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'River Council Revised' },
    })
    fireEvent.change(screen.getByLabelText('Rules Markdown'), {
      target: { value: '# River Council\n\nPlay.' },
    })

    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: {
        name: 'River Council Revised',
        rulesMarkdown: '# River Council\n\nPlay.',
      },
    })
  })

  it('preserves the selected initial phase through reordering', () => {
    const latestSource = renderGuided()

    fireEvent.click(screen.getByRole('button', { name: 'Add phase' }))
    setPhase(0, 'night', 'Night')
    fireEvent.click(screen.getByRole('button', { name: 'Add phase' }))
    setPhase(1, 'day', 'Day')
    fireEvent.click(screen.getByRole('button', { name: 'Move Day up' }))
    fireEvent.click(screen.getByLabelText('Track rounds'))
    fireEvent.change(screen.getByLabelText('Initial round'), {
      target: { value: '2' },
    })

    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: {
        phases: [{ id: 'day' }, { id: 'night' }],
        initialPhase: 'night',
        round: { enabled: true, initial: 2 },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove Night' }))
    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: { phases: [{ id: 'day' }], initialPhase: 'day' },
    })
  })

  it('preserves an explicitly selected initial phase when another phase is removed', () => {
    const latestSource = renderGuided({
      ...minimalGame,
      phases: [
        { id: 'night', label: 'Night' },
        { id: 'day', label: 'Day' },
        { id: 'dusk', label: 'Dusk' },
      ],
      initialPhase: 'dusk',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove Night' }))

    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: {
        phases: [{ id: 'day' }, { id: 'dusk' }],
        initialPhase: 'dusk',
      },
    })
  })

  it('keeps focus in a phase ID input after an accepted ID edit', () => {
    renderGuided({
      ...minimalGame,
      phases: [{ id: 'night', label: 'Night' }],
      initialPhase: 'night',
    })
    const input = screen.getByLabelText('Phase 1 ID')
    input.focus()

    fireEvent.change(input, { target: { value: 'evening' } })

    expect(screen.getByLabelText('Phase 1 ID')).toHaveFocus()
    expect(screen.getByLabelText('Phase 1 ID')).toHaveValue('evening')
  })

  it('keeps an incomplete number local until it becomes a valid integer', () => {
    const latestSource = renderGuided()
    const before = latestSource()

    fireEvent.change(screen.getByLabelText('Minimum players'), {
      target: { value: '' },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a positive whole number.',
    )
    expect(latestSource()).toBe(before)

    fireEvent.change(screen.getByLabelText('Minimum players'), {
      target: { value: '3' },
    })
    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: { players: { min: 3, max: 6 } },
    })
  })

  it('synchronizes the round draft when disabling and re-enabling rounds', () => {
    renderGuided({
      ...minimalGame,
      round: { enabled: true, initial: 5 },
    })

    expect(screen.getByLabelText('Initial round')).toHaveValue('5')
    fireEvent.click(screen.getByLabelText('Track rounds'))
    fireEvent.click(screen.getByLabelText('Track rounds'))

    expect(screen.getByLabelText('Initial round')).toHaveValue('1')
  })

  it('keeps numeric drafts and errors independent across canonical updates', () => {
    const latestSource = renderGuided()

    fireEvent.change(screen.getByLabelText('Minimum players'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText('Maximum players'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'River Council Revised' },
    })

    expect(screen.getByLabelText('Minimum players')).toHaveValue('')
    expect(screen.getByLabelText('Maximum players')).toHaveValue('1')
    expect(
      screen.getByText('Enter a positive whole number.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Maximum players cannot be lower than minimum players.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Minimum players'), {
      target: { value: '2' },
    })
    expect(
      screen.queryByText('Enter a positive whole number.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Maximum players cannot be lower than minimum players.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Maximum players')).toHaveValue('1')
    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: { name: 'River Council Revised', players: { min: 2, max: 6 } },
    })
  })

  it('rejects oversized guided serialization before invoking the parser', () => {
    const parse = vi.spyOn(gameParser, 'parseGameSource')
    const latestSource = renderGuided()
    parse.mockClear()

    fireEvent.change(screen.getByLabelText('Rules Markdown'), {
      target: { value: 'x'.repeat(MAX_GAME_SOURCE_BYTES + 1) },
    })

    expect(parse).not.toHaveBeenCalled()
    expect(latestSource()).toBe('')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Game source exceeds the 1 MiB limit.',
    )
    expect(screen.getByLabelText('Rules Markdown')).toHaveValue(
      minimalGame.rulesMarkdown,
    )
  })

  it('locks an existing game ID', () => {
    renderGuided(minimalGame, true)

    expect(screen.getByLabelText('Game ID')).toBeDisabled()
  })

  it('does not emit a deck change that invalidates an existing card selector', () => {
    const latestSource = renderGuided({
      ...minimalGame,
      roles: [
        {
          id: 'heart-reader',
          label: 'Heart Reader',
          summary: 'Reads hearts.',
          card: { label: 'Heart', selector: { suits: ['hearts'] } },
        },
      ],
    })
    const before = latestSource()

    fireEvent.change(screen.getByLabelText('Deck'), {
      target: { value: 'tarot' },
    })

    expect(latestSource()).toBe(before)
    expect(screen.getByRole('alert')).toHaveTextContent(/unknown suits value/i)
  })

  it('composes valid role distributions and digital dealing into the source', () => {
    const latestSource = renderGuided({
      ...minimalGame,
      players: { min: 5, max: 8 },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
    fireEvent.change(screen.getByLabelText('Role 1 ID'), {
      target: { value: 'oracle' },
    })
    fireEvent.change(screen.getByLabelText('Role 1 label'), {
      target: { value: 'Oracle' },
    })
    fireEvent.change(screen.getByLabelText('Role 1 summary'), {
      target: { value: 'Reads the signal.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
    fireEvent.change(screen.getByLabelText('Role 2 ID'), {
      target: { value: 'villager' },
    })
    fireEvent.change(screen.getByLabelText('Role 2 label'), {
      target: { value: 'Villager' },
    })
    fireEvent.change(screen.getByLabelText('Role 2 summary'), {
      target: { value: 'Finds the truth.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Add distribution band' }),
    )
    fireEvent.change(
      screen.getByLabelText('Distribution band 1 minimum players'),
      { target: { value: '5' } },
    )
    fireEvent.change(
      screen.getByLabelText('Distribution band 1 maximum players'),
      { target: { value: '8' } },
    )
    fireEvent.change(
      screen.getByLabelText('Distribution band 1 Oracle count'),
      { target: { value: '1' } },
    )
    fireEvent.change(
      screen.getByLabelText('Distribution band 1 Villager count'),
      { target: { value: 'remaining' } },
    )
    fireEvent.click(screen.getByLabelText('Enable digital dealing'))

    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: {
        roles: [{ id: 'oracle' }, { id: 'villager' }],
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
      },
    })
  })

  it('preserves incomplete role and distribution drafts after an unrelated edit', () => {
    const latestSource = renderGuided({
      ...minimalGame,
      players: { min: 5, max: 8 },
      roles: [
        { id: 'oracle', label: 'Oracle', summary: 'Reads the signal.' },
        { id: 'villager', label: 'Villager', summary: 'Finds the truth.' },
      ],
      roleDistributions: [
        {
          players: { min: 5, max: 8 },
          counts: { oracle: 1, villager: 'remaining' },
        },
      ],
    })

    fireEvent.change(screen.getByLabelText('Role 1 summary'), {
      target: { value: '' },
    })
    fireEvent.change(
      screen.getByLabelText('Distribution band 1 Oracle count'),
      { target: { value: '' } },
    )
    fireEvent.change(screen.getByLabelText('Game name'), {
      target: { value: 'River Council Revised' },
    })

    expect(screen.getByLabelText('Role 1 summary')).toHaveValue('')
    expect(
      screen.getByLabelText('Distribution band 1 Oracle count'),
    ).toHaveValue('')
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: { name: 'River Council Revised' },
    })
  })

  it('composes valid tracker fields into canonical game source', () => {
    const latestSource = renderGuided()

    fireEvent.click(screen.getByRole('button', { name: 'Add tracker field' }))
    fireEvent.change(screen.getByLabelText('Field 1 ID'), {
      target: { value: 'temperament' },
    })
    fireEvent.change(screen.getByLabelText('Field 1 type'), {
      target: { value: 'choice' },
    })
    fireEvent.change(screen.getByLabelText('Field 1 choices'), {
      target: { value: 'steady, daring' },
    })
    fireEvent.change(screen.getByLabelText('Field 1 default'), {
      target: { value: 'steady' },
    })

    expect(parseLatest(latestSource)).toMatchObject({
      ok: true,
      game: {
        fields: [
          {
            id: 'temperament',
            label: 'Field 1',
            type: 'choice',
            choices: ['steady', 'daring'],
            default: 'steady',
          },
        ],
      },
    })
  })
})
