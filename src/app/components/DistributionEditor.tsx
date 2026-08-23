import { useState } from 'react'

import type {
  AssignmentDefinition,
  GameMasterAssignmentVisibility,
  PlayerAssignmentVisibility,
  PlayersDefinition,
  RoleCount,
  RoleDefinition,
  RoleDistribution,
} from '../../games/model'

interface DistributionValue {
  readonly roleDistributions: readonly RoleDistribution[]
  readonly assignments?: AssignmentDefinition
}

interface DistributionEditorProps extends DistributionValue {
  readonly roles: readonly RoleDefinition[]
  readonly players: PlayersDefinition
  readonly onChange: (value: DistributionValue) => void
}

interface DistributionDraft {
  readonly min: string
  readonly max: string
  readonly counts: Readonly<Record<string, string>>
}

type DraftResult =
  | { readonly ok: true; readonly value: readonly RoleDistribution[] }
  | { readonly ok: false; readonly message: string }

function distributionDraft(distribution: RoleDistribution): DistributionDraft {
  return {
    min: String(distribution.players.min),
    max: String(distribution.players.max),
    counts: Object.fromEntries(
      Object.entries(distribution.counts).map(([id, count]) => [
        id,
        String(count),
      ]),
    ),
  }
}

function wholeNumber(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

function parseDrafts(
  drafts: readonly DistributionDraft[],
  roles: readonly RoleDefinition[],
  players: PlayersDefinition,
): DraftResult {
  if (drafts.length === 0) return { ok: true, value: [] }
  if (roles.length === 0 || players.max === undefined) {
    return {
      ok: false,
      message: 'Role distributions require roles and a maximum player count.',
    }
  }

  const distributions: RoleDistribution[] = []
  let nextMinimum = players.min
  for (const [index, draft] of drafts.entries()) {
    const min = wholeNumber(draft.min)
    const max = wholeNumber(draft.max)
    if (min === undefined || max === undefined) {
      return {
        ok: false,
        message: `Distribution band ${index + 1} needs whole-number player bounds.`,
      }
    }
    if (min !== nextMinimum || max < min || max > players.max) {
      return {
        ok: false,
        message:
          'Distribution bands must be ordered, contiguous, and within the supported player range.',
      }
    }

    const counts: Record<string, RoleCount> = {}
    let fixed = 0
    let remaining = 0
    for (const role of roles) {
      const draftCount = draft.counts[role.id]?.trim() ?? ''
      if (draftCount === 'remaining') {
        remaining += 1
        counts[role.id] = 'remaining'
        continue
      }
      const count = wholeNumber(draftCount)
      if (count === undefined) {
        return {
          ok: false,
          message: `Distribution band ${index + 1} needs a non-negative count or remaining for ${role.label}.`,
        }
      }
      fixed += count
      counts[role.id] = count
    }
    if (remaining > 1) {
      return {
        ok: false,
        message: 'At most one role count may be remaining in each band.',
      }
    }
    if (fixed > min) {
      return {
        ok: false,
        message: 'Fixed role counts cannot exceed the band minimum.',
      }
    }
    if (remaining === 0 && (min !== max || fixed !== min)) {
      return {
        ok: false,
        message:
          'A fixed-only distribution must exactly fill one player count.',
      }
    }
    distributions.push({ players: { min, max }, counts })
    nextMinimum = max + 1
  }
  if (nextMinimum !== players.max + 1) {
    return {
      ok: false,
      message: 'Distribution bands must cover every supported player count.',
    }
  }
  return { ok: true, value: distributions }
}

export function DistributionEditor({
  roles,
  players,
  roleDistributions,
  assignments,
  onChange,
}: DistributionEditorProps) {
  const [draftState, setDraftState] = useState(() => ({
    source: roleDistributions,
    values: roleDistributions.map(distributionDraft),
  }))
  const [error, setError] = useState<string>()
  const drafts =
    draftState.source === roleDistributions
      ? draftState.values
      : roleDistributions.map(distributionDraft)
  const completeDrafts = parseDrafts(drafts, roles, players)
  const canEnableAssignments =
    completeDrafts.ok && roles.length > 0 && completeDrafts.value.length > 0
  const canAddBand = roles.length > 0 && players.max !== undefined

  function updateDrafts(nextDrafts: readonly DistributionDraft[]) {
    setDraftState({ source: roleDistributions, values: [...nextDrafts] })
    const parsed = parseDrafts(nextDrafts, roles, players)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setError(undefined)
    onChange({
      roleDistributions: parsed.value,
      ...(assignments === undefined ? {} : { assignments }),
    })
  }

  function addBand() {
    const counts = Object.fromEntries(roles.map((role) => [role.id, '']))
    setDraftState({
      source: roleDistributions,
      values: [...drafts, { min: '', max: '', counts }],
    })
    setError('Complete every distribution band before digital dealing.')
  }

  function changeBand(
    index: number,
    patch: Partial<Pick<DistributionDraft, 'min' | 'max'>>,
  ) {
    updateDrafts(
      drafts.map((draft, bandIndex) =>
        bandIndex === index ? { ...draft, ...patch } : draft,
      ),
    )
  }

  function changeCount(index: number, roleId: string, value: string) {
    updateDrafts(
      drafts.map((draft, bandIndex) =>
        bandIndex === index
          ? { ...draft, counts: { ...draft.counts, [roleId]: value } }
          : draft,
      ),
    )
  }

  function moveBand(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= drafts.length) return
    const nextDrafts = [...drafts]
    const [draft] = nextDrafts.splice(index, 1)
    if (!draft) return
    nextDrafts.splice(destination, 0, draft)
    updateDrafts(nextDrafts)
  }

  function removeBand(index: number) {
    const nextDrafts = drafts.filter((_, bandIndex) => bandIndex !== index)
    const parsed = parseDrafts(nextDrafts, roles, players)
    if (
      assignments !== undefined &&
      (!parsed.ok || parsed.value.length === 0)
    ) {
      setError(
        'Disable digital dealing first before removing a distribution band.',
      )
      return
    }
    updateDrafts(nextDrafts)
  }

  function toggleAssignments(enabled: boolean) {
    if (!enabled) {
      onChange({ roleDistributions })
      return
    }
    if (!completeDrafts.ok || completeDrafts.value.length === 0) return
    onChange({
      roleDistributions: completeDrafts.value,
      assignments: {
        method: 'shuffle',
        visibility: { players: 'own', gameMaster: 'all' },
      },
    })
  }

  function changePlayerVisibility(
    playersVisibility: PlayerAssignmentVisibility,
  ) {
    if (!assignments) return
    onChange({
      roleDistributions,
      assignments: {
        ...assignments,
        visibility: { ...assignments.visibility, players: playersVisibility },
      },
    })
  }

  function changeGameMasterVisibility(
    gameMaster: GameMasterAssignmentVisibility,
  ) {
    if (!assignments) return
    onChange({
      roleDistributions,
      assignments: {
        ...assignments,
        visibility: { ...assignments.visibility, gameMaster },
      },
    })
  }

  return (
    <>
      <fieldset>
        <legend>Role distributions</legend>
        <div className="form-actions">
          <button disabled={!canAddBand} type="button" onClick={addBand}>
            Add distribution band
          </button>
        </div>
        {!canAddBand && (
          <p>Declare roles and a maximum player count before adding bands.</p>
        )}
        {drafts.map((draft, index) => (
          <div key={index}>
            <label>
              Distribution band {index + 1} minimum players
              <input
                inputMode="numeric"
                type="text"
                value={draft.min}
                onChange={(event) =>
                  changeBand(index, { min: event.target.value })
                }
              />
            </label>
            <label>
              Distribution band {index + 1} maximum players
              <input
                inputMode="numeric"
                type="text"
                value={draft.max}
                onChange={(event) =>
                  changeBand(index, { max: event.target.value })
                }
              />
            </label>
            {roles.map((role) => (
              <label key={role.id}>
                Distribution band {index + 1} {role.label} count
                <input
                  type="text"
                  value={draft.counts[role.id] ?? ''}
                  onChange={(event) =>
                    changeCount(index, role.id, event.target.value)
                  }
                />
              </label>
            ))}
            <div className="form-actions">
              <button
                aria-label={`Move distribution band ${index + 1} up`}
                disabled={index === 0}
                type="button"
                onClick={() => moveBand(index, -1)}
              >
                Move up
              </button>
              <button
                aria-label={`Move distribution band ${index + 1} down`}
                disabled={index === drafts.length - 1}
                type="button"
                onClick={() => moveBand(index, 1)}
              >
                Move down
              </button>
              <button
                aria-label={`Remove distribution band ${index + 1}`}
                type="button"
                onClick={() => removeBand(index)}
              >
                Remove band
              </button>
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>Digital dealing</legend>
        <label className="checkbox-field">
          <input
            aria-label="Enable digital dealing"
            checked={assignments !== undefined}
            disabled={assignments === undefined && !canEnableAssignments}
            type="checkbox"
            onChange={(event) => toggleAssignments(event.target.checked)}
          />
          <span>Shuffle and deal roles digitally</span>
        </label>
        {assignments !== undefined && (
          <>
            <label>
              Player assignment visibility
              <select
                disabled={!canEnableAssignments}
                value={assignments.visibility.players}
                onChange={(event) =>
                  changePlayerVisibility(
                    event.target.value as PlayerAssignmentVisibility,
                  )
                }
              >
                <option value="own">Own role</option>
                <option value="all">All roles</option>
                <option value="none">No roles</option>
              </select>
            </label>
            <label>
              Game Master assignment visibility
              <select
                disabled={!canEnableAssignments}
                value={assignments.visibility.gameMaster}
                onChange={(event) =>
                  changeGameMasterVisibility(
                    event.target.value as GameMasterAssignmentVisibility,
                  )
                }
              >
                <option value="all">All roles</option>
                <option value="none">No roles</option>
              </select>
            </label>
          </>
        )}
        {!canEnableAssignments && assignments === undefined && (
          <p>Complete roles and distribution coverage to enable dealing.</p>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
