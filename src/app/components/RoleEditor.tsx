import { useState } from 'react'

import { createStandardDeck, createTarotDeck } from '../../cards/decks'
import type { DeckType } from '../../cards/model'
import { selectCards, type CardSelector } from '../../cards/select'
import type {
  AssignmentDefinition,
  PlayerFieldDefinition,
  RoleDefinition,
  RoleDistribution,
} from '../../games/model'

interface RoleEditorProps {
  readonly roles: readonly RoleDefinition[]
  readonly deck: DeckType
  readonly roleDistributions: readonly RoleDistribution[]
  readonly assignments?: AssignmentDefinition
  readonly fields: readonly PlayerFieldDefinition[]
  readonly onChange: (roles: readonly RoleDefinition[]) => void
}

type SelectorProperty = keyof CardSelector

interface RoleDraft {
  readonly id: string
  readonly label: string
  readonly team: string
  readonly summary: string
  readonly cardEnabled: boolean
  readonly cardLabel: string
  readonly ids: string
  readonly suits: string
  readonly ranks: string
  readonly arcana: string
  readonly tags: string
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const SELECTOR_PROPERTIES = ['ids', 'suits', 'ranks', 'arcana', 'tags'] as const

function selectorText(values: readonly string[] | undefined): string {
  return values?.join(', ') ?? ''
}

function roleDraft(role: RoleDefinition): RoleDraft {
  return {
    id: role.id,
    label: role.label,
    team: role.team ?? '',
    summary: role.summary,
    cardEnabled: role.card !== undefined,
    cardLabel: role.card?.label ?? '',
    ids: selectorText(role.card?.selector.ids),
    suits: selectorText(role.card?.selector.suits),
    ranks: selectorText(role.card?.selector.ranks),
    arcana: selectorText(role.card?.selector.arcana),
    tags: selectorText(role.card?.selector.tags),
  }
}

function tokens(value: string): readonly string[] | undefined {
  const values = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
  return values.length === 0 ? undefined : values
}

function selectorFor(draft: RoleDraft): CardSelector {
  const selector: Record<string, readonly string[]> = {}
  for (const property of SELECTOR_PROPERTIES) {
    const values = tokens(draft[property])
    if (values !== undefined) selector[property] = values
  }
  return selector
}

function nextRoleId(roles: readonly RoleDefinition[]): string {
  let number = roles.length + 1
  while (roles.some((role) => role.id === `role-${number}`)) number += 1
  return `role-${number}`
}

function dependencySections(
  roleId: string,
  roleDistributions: readonly RoleDistribution[],
  assignments: AssignmentDefinition | undefined,
  fields: readonly PlayerFieldDefinition[],
): readonly string[] {
  const sections: string[] = []
  if (roleDistributions.some((distribution) => roleId in distribution.counts)) {
    sections.push('Role distributions')
  }
  if (
    fields.some((field) => field.type === 'role' && field.default === roleId)
  ) {
    sections.push('Tracker fields')
  }
  if (assignments !== undefined) sections.push('Digital dealing')
  return sections
}

function dependencyMessage(roleLabel: string, sections: readonly string[]) {
  return `${roleLabel} cannot be renamed or removed until these dependent sections are repaired: ${sections.join(', ')}.`
}

export function RoleEditor({
  roles,
  deck,
  roleDistributions,
  assignments,
  fields,
  onChange,
}: RoleEditorProps) {
  const [draftState, setDraftState] = useState(() => ({
    source: roles,
    values: roles.map(roleDraft),
  }))
  const [error, setError] = useState<string>()
  const drafts =
    draftState.source === roles ? draftState.values : roles.map(roleDraft)

  function setDrafts(values: readonly RoleDraft[]) {
    setDraftState({ source: roles, values: [...values] })
  }

  function validateDraft(
    draft: RoleDraft,
    index: number,
  ): RoleDefinition | undefined {
    if (!ID_PATTERN.test(draft.id)) {
      setError('Role IDs must be lowercase stable identifiers.')
      return undefined
    }
    if (
      roles.some(
        (role, roleIndex) => roleIndex !== index && role.id === draft.id,
      )
    ) {
      setError(`Role ID "${draft.id}" is already in use.`)
      return undefined
    }
    if (draft.label.trim() === '') {
      setError('Role labels must be non-empty.')
      return undefined
    }
    if (draft.summary.trim() === '') {
      setError('Role summaries must be non-empty.')
      return undefined
    }
    if (!draft.cardEnabled) {
      return {
        id: draft.id,
        label: draft.label.trim(),
        ...(draft.team.trim() === '' ? {} : { team: draft.team.trim() }),
        summary: draft.summary.trim(),
      }
    }
    if (draft.cardLabel.trim() === '') {
      setError('A role card label must be non-empty.')
      return undefined
    }
    const selector = selectorFor(draft)
    const selected = selectCards(
      deck === 'standard-52' ? createStandardDeck() : createTarotDeck(),
      selector,
    )
    if (!selected.ok) {
      setError(selected.diagnostic.message)
      return undefined
    }
    return {
      id: draft.id,
      label: draft.label.trim(),
      ...(draft.team.trim() === '' ? {} : { team: draft.team.trim() }),
      summary: draft.summary.trim(),
      card: { label: draft.cardLabel.trim(), selector },
    }
  }

  function changeDraft(index: number, patch: Partial<RoleDraft>) {
    const current = drafts[index]
    const previousRole = roles[index]
    if (!current || !previousRole) return
    const nextDraft = { ...current, ...patch }
    const nextDrafts = drafts.map((draft, roleIndex) =>
      roleIndex === index ? nextDraft : draft,
    )
    setDrafts(nextDrafts)

    if (nextDraft.id !== previousRole.id) {
      const sections = dependencySections(
        previousRole.id,
        roleDistributions,
        assignments,
        fields,
      )
      if (sections.length > 0) {
        setError(dependencyMessage(previousRole.label, sections))
        return
      }
    }

    const nextRole = validateDraft(nextDraft, index)
    if (!nextRole) return
    setError(undefined)
    onChange(
      roles.map((role, roleIndex) => (roleIndex === index ? nextRole : role)),
    )
  }

  function addRole() {
    const sections = [
      ...(roleDistributions.length === 0 ? [] : ['Role distributions']),
      ...(assignments === undefined ? [] : ['Digital dealing']),
    ]
    if (sections.length > 0) {
      setError(
        `A role cannot be added until these dependent sections are repaired: ${sections.join(', ')}.`,
      )
      return
    }
    const id = nextRoleId(roles)
    const role: RoleDefinition = {
      id,
      label: `Role ${roles.length + 1}`,
      summary: 'Describe this role.',
    }
    setDrafts([...drafts, roleDraft(role)])
    setError(undefined)
    onChange([...roles, role])
  }

  function moveRole(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= roles.length) return
    const nextRoles = [...roles]
    const [role] = nextRoles.splice(index, 1)
    if (!role) return
    nextRoles.splice(destination, 0, role)
    const nextDrafts = [...drafts]
    const [draft] = nextDrafts.splice(index, 1)
    if (draft) nextDrafts.splice(destination, 0, draft)
    setDrafts(nextDrafts)
    setError(undefined)
    onChange(nextRoles)
  }

  function removeRole(index: number) {
    const role = roles[index]
    if (!role) return
    const sections = dependencySections(
      role.id,
      roleDistributions,
      assignments,
      fields,
    )
    if (sections.length > 0) {
      setError(dependencyMessage(role.label, sections))
      return
    }
    setDrafts(drafts.filter((_, roleIndex) => roleIndex !== index))
    setError(undefined)
    onChange(roles.filter((_, roleIndex) => roleIndex !== index))
  }

  function enableCard(index: number, enabled: boolean) {
    if (!enabled) {
      changeDraft(index, { cardEnabled: false })
      return
    }
    const firstCard =
      deck === 'standard-52' ? createStandardDeck()[0] : createTarotDeck()[0]
    changeDraft(index, {
      cardEnabled: true,
      cardLabel: 'Card marker',
      ids: firstCard?.id ?? '',
    })
  }

  return (
    <fieldset>
      <legend>Roles</legend>
      <div className="form-actions">
        <button type="button" onClick={addRole}>
          Add role
        </button>
      </div>
      {drafts.map((draft, index) => {
        const displayLabel = draft.label.trim() || `Role ${index + 1}`
        return (
          <div key={`${roles[index]?.id ?? 'draft'}-${index}`}>
            <label>
              Role {index + 1} ID
              <input
                type="text"
                value={draft.id}
                onChange={(event) =>
                  changeDraft(index, { id: event.target.value })
                }
              />
            </label>
            <label>
              Role {index + 1} label
              <input
                type="text"
                value={draft.label}
                onChange={(event) =>
                  changeDraft(index, { label: event.target.value })
                }
              />
            </label>
            <label>
              Role {index + 1} team
              <input
                type="text"
                value={draft.team}
                onChange={(event) =>
                  changeDraft(index, { team: event.target.value })
                }
              />
            </label>
            <label>
              Role {index + 1} summary
              <textarea
                rows={3}
                value={draft.summary}
                onChange={(event) =>
                  changeDraft(index, { summary: event.target.value })
                }
              />
            </label>
            <label className="checkbox-field">
              <input
                aria-label={`${displayLabel} uses a card marker`}
                checked={draft.cardEnabled}
                type="checkbox"
                onChange={(event) => enableCard(index, event.target.checked)}
              />
              <span>Use a card marker</span>
            </label>
            {draft.cardEnabled && (
              <div>
                <label>
                  Role {index + 1} card label
                  <input
                    type="text"
                    value={draft.cardLabel}
                    onChange={(event) =>
                      changeDraft(index, { cardLabel: event.target.value })
                    }
                  />
                </label>
                {SELECTOR_PROPERTIES.map((property: SelectorProperty) => (
                  <label key={property}>
                    Role {index + 1} card {property}
                    <input
                      type="text"
                      value={draft[property]}
                      onChange={(event) =>
                        changeDraft(index, {
                          [property]: event.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="form-actions">
              <button
                aria-label={`Move ${displayLabel} up`}
                disabled={index === 0}
                type="button"
                onClick={() => moveRole(index, -1)}
              >
                Move up
              </button>
              <button
                aria-label={`Move ${displayLabel} down`}
                disabled={index === roles.length - 1}
                type="button"
                onClick={() => moveRole(index, 1)}
              >
                Move down
              </button>
              <button
                aria-label={`Remove ${displayLabel}`}
                type="button"
                onClick={() => removeRole(index)}
              >
                Remove role
              </button>
            </div>
          </div>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
