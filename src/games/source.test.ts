import { describe, expect, it } from 'vitest'

import type { GameDefinition } from './model'
import { parseGameSource } from './parse'
import {
  createGameTemplate,
  gameSourceFitsLimit,
  serializeGameSource,
  sourceHasFrontmatterComments,
} from './source'

const fullGame: GameDefinition = {
  schemaVersion: 1,
  id: 'full-game',
  name: 'Full Game',
  summary: 'A complete source fixture.',
  deck: 'standard-52',
  players: { min: 2, max: 4 },
  roles: [
    {
      id: 'leader',
      label: 'Leader',
      team: 'blue',
      summary: 'Leads the team.',
      card: { label: 'Hearts', selector: { suits: ['hearts'] } },
    },
    { id: 'scout', label: 'Scout', summary: 'Finds clues.' },
  ],
  roleDistributions: [
    { players: { min: 2, max: 2 }, counts: { leader: 1, scout: 1 } },
    { players: { min: 3, max: 4 }, counts: { leader: 1, scout: 'remaining' } },
  ],
  assignments: { method: 'shuffle', visibility: { players: 'own', gameMaster: 'all' } },
  phases: [{ id: 'setup', label: 'Setup' }, { id: 'play', label: 'Play' }],
  initialPhase: 'setup',
  round: { enabled: true, initial: 1 },
  fields: [
    { id: 'ready', label: 'Ready', type: 'boolean', default: false },
    { id: 'choice', label: 'Choice', type: 'choice', choices: ['a', 'b'], default: 'a' },
    { id: 'score', label: 'Score', type: 'number', default: 0, min: 0, max: 10, step: 1 },
    { id: 'note', label: 'Note', type: 'text', default: '', multiline: true },
    { id: 'role', label: 'Role', type: 'role', default: 'scout' },
  ],
  rulesMarkdown: '# Full Game\n\nRules.\n',
  source: 'fixture.md',
}

describe('game source', () => {
  it('serializes every version-1 branch into parseable canonical source', () => {
    const source = serializeGameSource(fullGame)
    const reparsed = parseGameSource(source, 'custom/full-game/game.md')

    expect(reparsed).toMatchObject({
      ok: true,
      game: { ...fullGame, source: 'custom/full-game/game.md' },
    })
    expect(source).toContain('game_master: all')
    expect(source).toContain('# Full Game\n')
  })

  it('uses one UTF-8 byte limit for templates, paste, storage, and shares', () => {
    expect(gameSourceFitsLimit('é'.repeat(524_288))).toBe(true)
    expect(gameSourceFitsLimit('é'.repeat(524_289))).toBe(false)
  })

  it('creates a valid minimal editable template', () => {
    expect(parseGameSource(createGameTemplate(), 'custom/new-game/game.md')).toMatchObject({
      ok: true,
      game: { id: 'new-game', fields: [], roles: [] },
    })
  })

  it('detects comments only in frontmatter', () => {
    expect(sourceHasFrontmatterComments('---\n# comment\nid: x\n---\n# rules')).toBe(true)
    expect(sourceHasFrontmatterComments('---\nid: x\n---\n# rules')).toBe(false)
    expect(sourceHasFrontmatterComments('# before\n---\nid: x\n---\n')).toBe(false)
  })
})
