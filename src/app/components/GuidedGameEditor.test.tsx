import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { GameDefinition } from '../../games/model'
import { parseGameSource } from '../../games/parse'
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
})
